

export interface ModelError { 
  code: ModelError.CodeEnum;
  message: string;
  details?: { [key: string]: string; };
}
export namespace ModelError {
  export const CodeEnum = {
    BadRequest: 'BAD_REQUEST',
    Unauthorized: 'UNAUTHORIZED',
    Forbidden: 'FORBIDDEN',
    NotFound: 'NOT_FOUND',
    Conflict: 'CONFLICT',
    TooManyRequests: 'TOO_MANY_REQUESTS',
    InternalError: 'INTERNAL_ERROR',
    ServiceUnavailable: 'SERVICE_UNAVAILABLE',
    LimitExceeded: 'LIMIT_EXCEEDED',
    AccountFrozen: 'ACCOUNT_FROZEN'
  } as const;
  export type CodeEnum = typeof CodeEnum[keyof typeof CodeEnum];
}


