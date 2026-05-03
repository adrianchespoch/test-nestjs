import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { DomainError } from '../../domain/errors/domain.error';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  requestId?: string;
  timestamp: string;
  details?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();

    const body = this.toBody(exception, req);
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, req: Request & { id?: string }): ErrorBody {
    const base = {
      path: req.url,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof DomainError) {
      return {
        ...base,
        statusCode: exception.httpStatus,
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ?? exception.message);
      return {
        ...base,
        statusCode: status,
        code: this.codeFromStatus(status),
        message: Array.isArray(message) ? message.join('; ') : String(message),
        ...(typeof response === 'object' ? { details: response } : {}),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaKnown(exception, base);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.warn({ err: exception }, 'prisma.validation_error');
      return {
        ...base,
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'INVALID_QUERY',
        message: 'Invalid database query parameters',
      };
    }

    this.logger.error({ err: exception, requestId: req.id }, 'unhandled.exception');
    return {
      ...base,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected server error',
    };
  }

  private fromPrismaKnown(
    e: Prisma.PrismaClientKnownRequestError,
    base: { path: string; requestId?: string; timestamp: string },
  ): ErrorBody {
    switch (e.code) {
      case 'P2002':
        return {
          ...base,
          statusCode: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: 'Resource already exists',
        };
      case 'P2025':
        return {
          ...base,
          statusCode: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'Resource not found',
        };
      case 'P2003':
        return {
          ...base,
          statusCode: HttpStatus.CONFLICT,
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Referenced resource is invalid',
        };
      default:
        this.logger.error({ err: e }, 'prisma.unmapped_error');
        return {
          ...base,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'Database operation failed',
        };
    }
  }

  private codeFromStatus(status: number): string {
    if (status === 400) return 'BAD_REQUEST';
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    if (status === 422) return 'UNPROCESSABLE';
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500) return 'INTERNAL_SERVER_ERROR';
    return 'ERROR';
  }
}
