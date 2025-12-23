import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { TypeOrmExceptionFilter } from './common/filters/typeorm-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Get EnvV -----
  const configService = app.get(ConfigService);
  const PORT = configService.get<number>('port');

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove extra data
      forbidNonWhitelisted: true, // exception for extra data
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new TypeOrmExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Users & Tasks API')
    .setDescription('Prueba técnica NestJS + TypeORM')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(PORT, host);
  logger.log(`Application running on http://${host}:${PORT}`);
}
bootstrap();
