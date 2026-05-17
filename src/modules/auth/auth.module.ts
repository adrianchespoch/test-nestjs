import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { RbacModule } from '../rbac/rbac.module';

import { AdminUnlockUserUseCase } from './application/use-cases/admin-unlock-user.use-case';
import { HandleOAuthCallbackUseCase } from './application/use-cases/handle-oauth-callback.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { ResendVerificationUseCase } from './application/use-cases/resend-verification.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';

import { ACCOUNT_PROVIDER_REPOSITORY } from './domain/ports/account-provider.repository';
import { EMAIL_SENDER } from './domain/ports/email-sender.port';
import { HASHER } from './domain/ports/hasher.port';
import { JWT_SIGNER } from './domain/ports/jwt-signer.port';
import { OAUTH_STATE_STORE } from './domain/ports/oauth-state-store.port';
import { ONE_TIME_TOKEN_GENERATOR } from './domain/ports/one-time-token-generator.port';
import { ONE_TIME_TOKEN_REPOSITORY } from './domain/ports/one-time-token.repository';
import { REFRESH_TOKEN_GENERATOR } from './domain/ports/refresh-token-generator.port';
import { REFRESH_TOKEN_REPOSITORY } from './domain/ports/refresh-token.repository';
import { SESSION_REPOSITORY } from './domain/ports/session.repository';
import { USER_REPOSITORY } from './domain/ports/user.repository';

import { ArgonHasher } from './infrastructure/crypto/argon-hasher';
import { JwtSigner } from './infrastructure/crypto/jwt-signer';
import { OneTimeTokenGenerator } from './infrastructure/crypto/one-time-token-generator';
import { RefreshTokenGenerator } from './infrastructure/crypto/refresh-token-generator';
import { ConsoleMailer } from './infrastructure/mailer/console-mailer';
import { RedisOAuthStateStore } from './infrastructure/oauth/redis-oauth-state.store';
import { PrismaAccountProviderRepository } from './infrastructure/persistence/prisma-account-provider.repository';
import { PrismaOneTimeTokenRepository } from './infrastructure/persistence/prisma-one-time-token.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/persistence/prisma-refresh-token.repository';
import { PrismaSessionRepository } from './infrastructure/persistence/prisma-session.repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';

import { AdminController } from './presentation/controllers/admin.controller';
import { AuthController } from './presentation/controllers/auth.controller';
import { OAuthController } from './presentation/controllers/oauth.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { GithubStrategy } from './presentation/strategies/github.strategy';
import { GoogleStrategy } from './presentation/strategies/google.strategy';
import { JwtStrategy } from './presentation/strategies/jwt.strategy';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    RbacModule,
  ],
  controllers: [AuthController, AdminController, OAuthController],
  providers: [
    // Use cases
    RegisterUserUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    VerifyEmailUseCase,
    ResendVerificationUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    AdminUnlockUserUseCase,
    HandleOAuthCallbackUseCase,

    // Adapters concretos
    ArgonHasher,
    JwtSigner,
    RefreshTokenGenerator,
    OneTimeTokenGenerator,
    ConsoleMailer,
    RedisOAuthStateStore,
    PrismaUserRepository,
    PrismaSessionRepository,
    PrismaRefreshTokenRepository,
    PrismaOneTimeTokenRepository,
    PrismaAccountProviderRepository,

    // Bindings port → adapter
    { provide: HASHER, useExisting: ArgonHasher },
    { provide: JWT_SIGNER, useExisting: JwtSigner },
    { provide: REFRESH_TOKEN_GENERATOR, useExisting: RefreshTokenGenerator },
    { provide: ONE_TIME_TOKEN_GENERATOR, useExisting: OneTimeTokenGenerator },
    { provide: EMAIL_SENDER, useExisting: ConsoleMailer },
    { provide: OAUTH_STATE_STORE, useExisting: RedisOAuthStateStore },
    { provide: USER_REPOSITORY, useExisting: PrismaUserRepository },
    { provide: SESSION_REPOSITORY, useExisting: PrismaSessionRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useExisting: PrismaRefreshTokenRepository },
    { provide: ONE_TIME_TOKEN_REPOSITORY, useExisting: PrismaOneTimeTokenRepository },
    { provide: ACCOUNT_PROVIDER_REPOSITORY, useExisting: PrismaAccountProviderRepository },

    // Strategies + guard
    JwtStrategy,
    // OAuth es opcional: passport-oauth2 lanza si clientID está vacío, así que
    // solo registramos la estrategia cuando hay credenciales configuradas.
    {
      provide: GoogleStrategy,
      useFactory: (config: ConfigService): GoogleStrategy | null =>
        config.get<string>('GOOGLE_CLIENT_ID') ? new GoogleStrategy(config) : null,
      inject: [ConfigService],
    },
    {
      provide: GithubStrategy,
      useFactory: (config: ConfigService): GithubStrategy | null =>
        config.get<string>('GITHUB_CLIENT_ID') ? new GithubStrategy(config) : null,
      inject: [ConfigService],
    },
    JwtAuthGuard,
  ],
  exports: [JwtAuthGuard, JwtStrategy],
})
export class AuthModule {}
