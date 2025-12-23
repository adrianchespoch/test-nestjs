import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { QueryFailedError } from 'typeorm';

type MysqlQueryError = {
  code?: string;
  errno?: number;
  sqlMessage?: string;
};

@Catch(QueryFailedError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const err = exception as unknown as { driverError?: MysqlQueryError };
    const driver = err.driverError;

    // MySQL duplicate unique: ER_DUP_ENTRY (errno 1062)
    if (driver?.code === 'ER_DUP_ENTRY' || driver?.errno === 1062) {
      return res.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'Email already exists',
        path: req.url,
        timestamp: new Date().toISOString(),
      });
    }

    // fallback: no filtrar detalles internos en prod
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Unexpected database error',
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
