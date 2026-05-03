import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('dev', 'test', 'staging', 'prod', 'production').required(),
  PORT: Joi.number().port().default(3000),
  HOST: Joi.string().default('0.0.0.0'),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  APP_URL: Joi.string().uri().required(),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .required(),
  REDIS_REQUIRED: Joi.boolean().default(true),

  COOKIE_SECRET: Joi.string().min(32).required(),
  COOKIE_DOMAIN: Joi.string().required(),
  COOKIE_SAMESITE: Joi.string().valid('Strict', 'Lax', 'None').default('Strict'),

  JWT_PRIVATE_KEY: Joi.string().allow('').optional(),
  JWT_PUBLIC_KEY: Joi.string().allow('').optional(),
  JWT_ACCESS_TTL_SEC: Joi.number().default(900),
  JWT_REFRESH_TTL_SEC: Joi.number().default(2592000),

  CORS_ORIGINS: Joi.string().required(),

  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().optional(),

  GITHUB_CLIENT_ID: Joi.string().allow('').optional(),
  GITHUB_CLIENT_SECRET: Joi.string().allow('').optional(),
  GITHUB_CALLBACK_URL: Joi.string().uri().optional(),

  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().port().required(),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  EMAIL_FROM: Joi.string().email().required(),

  ARGON2_MEMORY_COST: Joi.number().default(65536),
  ARGON2_TIME_COST: Joi.number().default(3),
  ARGON2_PARALLELISM: Joi.number().default(1),

  RATE_LIMIT_LOGIN_PER_10MIN: Joi.number().default(5),
  ACCOUNT_LOCKOUT_MINUTES: Joi.number().default(15),

  OTEL_SERVICE_NAME: Joi.string().default('nestjs-skeleton'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().allow('').optional(),

  COMMIT_SHA: Joi.string().default('unknown'),
}).unknown(true);
