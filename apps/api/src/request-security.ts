import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX,
  RequestSecurityError,
  RequestSecurityManager as SharedRequestSecurityManager,
  type RateLimitOptions as SharedRateLimitOptions,
  type RateLimitState,
  type SignatureComponents,
  type ValidatedMutationContext,
  createSignaturePayload as createSharedSignaturePayload,
  serializeBody,
} from '@qzd/shared/request-security';

type RateLimitOptions = SharedRateLimitOptions<Request>;

interface RequestSecurityOptions {
  publicKeyHex?: string;
  rateLimit?: RateLimitOptions;
}

export { serializeBody };

export function createSignaturePayload(components: SignatureComponents): Uint8Array {
  return createSharedSignaturePayload(
    components.method,
    components.path,
    components.idempotencyKey,
    components.nonce,
    components.serializedBody,
  );
}

export class RequestSecurityManager {
  private readonly manager: SharedRequestSecurityManager<Request>;

  constructor(options: RequestSecurityOptions = {}) {
    this.manager = new SharedRequestSecurityManager<Request>({
      publicKeyHex:
        options.publicKeyHex ??
        process.env.QZD_REQUEST_SIGNING_PUBLIC_KEY ??
        DEFAULT_REQUEST_SIGNING_PUBLIC_KEY_HEX,
      rateLimit: options.rateLimit,
    });
  }

  validateMutation(request: Request, body: unknown): ValidatedMutationContext {
    try {
      const result = this.manager.validateMutation(request, body);
      this.applyRateLimitHeaders(request, result.rateLimitState);
      return result.context;
    } catch (error) {
      return this.rethrow(request, error);
    }
  }

  applyIdempotency<T>(context: ValidatedMutationContext, factory: () => T): T {
    try {
      return this.manager.applyIdempotency(context, factory);
    } catch (error) {
      return this.rethrow(undefined, error);
    }
  }

  private rethrow(request: Request | undefined, error: unknown): never {
    if (!(error instanceof RequestSecurityError)) {
      throw error;
    }

    if (request) {
      this.applyRateLimitHeaders(request, error.rateLimitState);
    }

    switch (error.status) {
      case 400:
        throw new BadRequestException(error.message);
      case 401:
        throw new UnauthorizedException({
          code: error.code,
          message: error.message,
        });
      case 409:
        throw new ConflictException({
          code: error.code,
          message: error.message,
        });
      case 429:
        throw new HttpException(
          {
            code: error.code,
            message: error.message,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      default:
        throw error;
    }
  }

  private applyRateLimitHeaders(request: Request, state?: RateLimitState): void {
    if (!state) {
      return;
    }

    const response = this.getResponse(request);
    if (!response) {
      return;
    }

    response.set('X-RateLimit-Limit', state.limit.toString());
    response.set('X-RateLimit-Remaining', Math.max(0, state.remaining).toString());
    response.set('X-RateLimit-Reset', Math.ceil(state.resetAt / 1000).toString());
    if (state.limited && typeof state.retryAfterSeconds === 'number') {
      response.set('Retry-After', Math.max(1, state.retryAfterSeconds).toString());
    }
  }

  private getResponse(request: Request): HeaderWritableResponse | undefined {
    const requestLike = request as Partial<Request> & { res?: unknown };
    const response = requestLike.res;
    if (!response || typeof response !== 'object') {
      return undefined;
    }

    const candidate = response as Partial<HeaderWritableResponse>;
    return typeof candidate.set === 'function' ? (candidate as HeaderWritableResponse) : undefined;
  }
}

interface HeaderWritableResponse {
  set(field: string, value: string): unknown;
}
