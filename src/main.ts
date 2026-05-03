// MUST be first: OTel auto-instrumentations need to hook before any other module is loaded.
import './otel';
import 'reflect-metadata';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.flushLogs();

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3000;
  const host = config.get<string>('HOST') ?? '0.0.0.0';

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(cookieParser(config.get<string>('COOKIE_SECRET')));

  app.use(
    helmet({
      contentSecurityPolicy: false, // permitir Swagger UI; tightening per-route en v6
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // gzip/deflate responses > 1KB. Reduce payload JSON ~70-90% sin overhead notable.
  // Saltea SSE / streams si el cliente declara `x-no-compression`.
  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
    }),
  );

  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );

  app.enableShutdownHooks();

  // Swagger
  const swagger = new DocumentBuilder()
    .setTitle('NestJS Skeleton API')
    .setDescription('Production-ready NestJS skeleton — see /AGENTS for design and Gherkin specs.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('refresh')
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port, host);

  console.log(`[bootstrap] listening on http://${host}:${port} — docs at /api/docs`);
}

bootstrap().catch((err) => {
  console.error('[bootstrap] fatal', err);
  process.exit(1);
});
