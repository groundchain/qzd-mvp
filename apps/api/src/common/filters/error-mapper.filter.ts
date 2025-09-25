import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Optional
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ZodError } from 'zod';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
  error?: string;
}

@Catch()
export class ErrorMapperFilter implements ExceptionFilter {
  constructor(@Optional() private readonly logger?: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    if (this.logger) {
      this.logger.error({ err: exception });
    } else {
      console.error(exception);
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'object' && response !== null
          ? this.extractMessageFromResponse(response) ?? exception.message
          : response;
      return {
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url ?? '',
        error: exception.name
      };
    }

    if (exception instanceof PrismaClientKnownRequestError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: `Database error: ${exception.code}`,
        timestamp: new Date().toISOString(),
        path: request.url ?? '',
        error: 'PrismaClientKnownRequestError'
      };
    }

    if (exception instanceof ZodError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.errors.map((err) => err.message),
        timestamp: new Date().toISOString(),
        path: request.url ?? '',
        error: 'ValidationError'
      };
    }

    const message = exception instanceof Error ? exception.message : 'Unexpected error';

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      timestamp: new Date().toISOString(),
      path: request.url ?? '',
      error: exception instanceof Error ? exception.name : 'Error'
    };
  }

  private extractMessageFromResponse(response: unknown): string | string[] | undefined {
    if (typeof response !== 'object' || response === null) {
      return undefined;
    }

    const payload = response as Record<string, unknown>;
    const message = payload.message;

    if (typeof message === 'string' || Array.isArray(message)) {
      return message as string | string[];
    }

    return undefined;
  }
}
