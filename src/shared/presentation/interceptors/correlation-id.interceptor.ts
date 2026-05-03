import { randomUUID } from 'node:crypto';
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Request, Response } from 'express';

/**
 * Ensures every request carries an `x-request-id` header in and out.
 * If absent, a uuid v4 is generated. nestjs-pino picks it up via `genReqId`.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();

    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);

    return next.handle();
  }
}
