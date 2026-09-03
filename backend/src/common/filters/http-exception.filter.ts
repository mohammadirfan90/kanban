import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = this.buildPayload(exception);
    const body: ErrorResponseBody = {
      statusCode: payload.statusCode,
      message: payload.message,
      error: payload.error,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} ${body.error}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private buildPayload(exception: unknown): {
    statusCode: number;
    message: string | string[];
    error: string;
  } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return {
          statusCode: exception.getStatus(),
          message: res,
          error: exception.name,
        };
      }
      if (res && typeof res === 'object') {
        const obj = res as Record<string, unknown>;
        return {
          statusCode: typeof obj.statusCode === 'number' ? obj.statusCode : exception.getStatus(),
          message: Array.isArray(obj.message)
            ? (obj.message as string[])
            : typeof obj.message === 'string'
              ? obj.message
              : exception.message,
          error: typeof obj.error === 'string' ? obj.error : exception.name,
        };
      }
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'InternalServerError',
    };
  }
}
