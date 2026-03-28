import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof PrismaClientValidationError) {
      this.logger.warn(
        `PrismaClientValidationError: ${exception.message}\n${exception.stack}`,
      );
      const status = HttpStatus.BAD_REQUEST;
      const errorResponse = {
        success: false,
        message: this.genericClientMessage(),
        error: {
          code: 'INVALID_REQUEST',
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      };
      response.status(status).json(errorResponse);
      return;
    }

    if (exception instanceof PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaKnownRequestError(exception);
      const metaStr =
        exception.meta != null ? JSON.stringify(exception.meta) : '';
      this.logger.error(
        `Prisma ${exception.code}: ${exception.message}${metaStr ? ` | ${metaStr}` : ''}`,
        exception.stack,
      );
      if (exception.code === 'P2022') {
        this.logger.error(
          'Schema mismatch (P2022): apply migrations to this database (e.g. prisma migrate deploy) so it matches prisma/schema.prisma.',
        );
      }
      const errorResponse = {
        success: false,
        message: mapped.clientMessage,
        error: {
          code: mapped.code,
        },
        timestamp: new Date().toISOString(),
        path: request.url,
      };
      response.status(mapped.status).json(errorResponse);
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message || 'An error occurred';

    const errorDetails =
      typeof exceptionResponse === 'object' && (exceptionResponse as any).error
        ? (exceptionResponse as any).error
        : undefined;

    if (!(exception instanceof HttpException) && exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    const errorResponse = {
      success: false,
      message: Array.isArray(message) ? message[0] : message,
      error: {
        code: this.getErrorCode(status),
        ...(errorDetails !== undefined ? { details: errorDetails } : {}),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  /** Safe message for any response body; details stay in logs only. */
  private genericClientMessage(): string {
    return 'We could not process your request. Please try again later.';
  }

  private mapPrismaKnownRequestError(
    exception: PrismaClientKnownRequestError,
  ): { status: number; clientMessage: string; code: string } {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          clientMessage: 'This value is already in use.',
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          clientMessage: 'The requested item was not found.',
          code: 'RECORD_NOT_FOUND',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          clientMessage: 'This request references invalid or missing data.',
          code: 'FOREIGN_KEY_CONSTRAINT_FAILED',
        };
      case 'P2022':
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          clientMessage: this.genericClientMessage(),
          code: 'SERVICE_UNAVAILABLE',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          clientMessage: this.genericClientMessage(),
          code: 'DATABASE_ERROR',
        };
    }
  }

  private getErrorCode(status: number): string {
    const errorCodes: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };

    return errorCodes[status] || 'UNKNOWN_ERROR';
  }
}

