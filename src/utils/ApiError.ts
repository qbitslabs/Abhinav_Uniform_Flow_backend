export class ApiError extends Error {
  statusCode: number;
  error: string;
  details?: unknown;

  constructor(statusCode: number, message: string, error?: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.error = error || statusCodeToTitle(statusCode);
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, 'Bad Request', details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message, 'Unauthorized');
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, 'Forbidden');
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, 'Not Found');
  }

  static conflict(message: string) {
    return new ApiError(409, message, 'Conflict');
  }
}

function statusCodeToTitle(code: number): string {
  const map: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Validation Error',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
  };
  return map[code] || 'Error';
}
