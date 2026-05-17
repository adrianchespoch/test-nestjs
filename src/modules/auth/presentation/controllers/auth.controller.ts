import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../../../shared/presentation/dtos/api-error.dto';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { RequestPasswordResetUseCase } from '../../application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case';
import { ResendVerificationUseCase } from '../../application/use-cases/resend-verification.use-case';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case';
import { LoginDto, LoginResponseDto } from '../dtos/login.dto';
import {
  ConfirmPasswordResetDto,
  RequestPasswordResetDto,
  ResendVerificationDto,
} from '../dtos/password-reset.dto';
import { RegisterDto, RegisterResponseDto } from '../dtos/register.dto';
import {
  AcceptedResponseDto,
  EmailVerifiedResponseDto,
  PasswordUpdatedResponseDto,
} from '../dtos/auth-responses.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

const REFRESH_COOKIE = 'refresh';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly resendVerificationUseCase: ResendVerificationUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } }) // 5 / hora / IP
  @ApiOperation({ summary: 'Register a new user with email + password' })
  @ApiCreatedResponse({ type: RegisterResponseDto, description: 'Usuario creado.' })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Validation error' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Email already exists' })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    const result = await this.registerUseCase.execute(dto);
    if (result.isErr()) throw result.error; // GlobalExceptionFilter mapea a HTTP
    return { userId: result.value.userId };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 600_000, limit: 5 } }) // 5 / 10min / IP
  @ApiOperation({
    summary: 'Login with email + password',
    description: 'Setea cookie `refresh` HttpOnly firmada (path `/api/auth`).',
  })
  @ApiOkResponse({ type: LoginResponseDto, description: 'Login OK; cookie refresh seteada.' })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Invalid credentials' })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'Account locked / email not verified' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.loginUseCase.execute({
      email: dto.email,
      password: dto.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if (result.isErr()) throw result.error;

    this.setRefreshCookie(res, result.value.refreshToken, result.value.refreshTokenExpiresAt);
    return {
      accessToken: result.value.accessToken,
      accessTokenExpiresInSec: result.value.accessTokenExpiresInSec,
      userId: result.value.userId,
      sessionId: result.value.sessionId,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Rotate refresh token + issue new access token',
    description: 'Lee la cookie `refresh`. Reuso de token revocado → revoca toda la familia.',
  })
  @ApiOkResponse({ type: LoginResponseDto, description: 'Token rotado; nueva cookie refresh.' })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<LoginResponseDto, 'userId'>> {
    const raw = (req.signedCookies?.[REFRESH_COOKIE] ??
      req.cookies?.[REFRESH_COOKIE] ??
      '') as string;
    const result = await this.refreshUseCase.execute({ rawRefreshToken: raw });
    if (result.isErr()) {
      this.clearRefreshCookie(res);
      throw result.error;
    }

    this.setRefreshCookie(res, result.value.refreshToken, result.value.refreshTokenExpiresAt);
    return {
      accessToken: result.value.accessToken,
      accessTokenExpiresInSec: result.value.accessTokenExpiresInSec,
      sessionId: result.value.sessionId,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke current refresh token + clear cookie (idempotent)' })
  @ApiNoContentResponse({ description: 'Sesión revocada (o no había sesión).' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const raw = (req.signedCookies?.[REFRESH_COOKIE] ??
      req.cookies?.[REFRESH_COOKIE] ??
      '') as string;
    await this.logoutUseCase.execute({ rawRefreshToken: raw || undefined });
    this.clearRefreshCookie(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions across devices' })
  @ApiNoContentResponse({ description: 'Todas las sesiones revocadas.' })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Falta o inválido el access token.' })
  logoutAll(@Res({ passthrough: true }) res: Response): void {
    // Implementación completa en M3.x — por ahora limpia cookie del browser actual.
    this.clearRefreshCookie(res);
  }

  @Get('email/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Verify email via one-time token' })
  @ApiQuery({
    name: 'token',
    required: true,
    example: 'a3f1c9e2b7d84605f1a2b3c4d5e6f7081920a1b2c3d4e5f60718293a4b5c6d7e',
  })
  @ApiOkResponse({ type: EmailVerifiedResponseDto, description: 'Email verificado.' })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Token invalid or expired' })
  async verifyEmail(@Query('token') token: string): Promise<{ verified: true }> {
    const result = await this.verifyEmailUseCase.execute({ rawToken: token });
    if (result.isErr()) throw result.error;
    return { verified: true };
  }

  @Post('email/verify/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60_000, limit: 1 } }) // 1 / minuto / IP
  @ApiOperation({ summary: 'Resend verification email (idempotent, no leak)' })
  @ApiAcceptedResponse({
    type: AcceptedResponseDto,
    description: 'Always returns 202 to avoid email enumeration',
  })
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<{ accepted: true }> {
    await this.resendVerificationUseCase.execute({ email: dto.email });
    return { accepted: true };
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 600_000, limit: 5 } })
  @ApiOperation({ summary: 'Request password reset email (no leak of existence)' })
  @ApiAcceptedResponse({
    type: AcceptedResponseDto,
    description: 'Always returns 202; email sent only if account exists',
  })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto): Promise<{ accepted: true }> {
    await this.requestPasswordResetUseCase.execute({ email: dto.email });
    return { accepted: true };
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 600_000, limit: 5 } })
  @ApiOperation({ summary: 'Confirm password reset with token + new password' })
  @ApiOkResponse({
    type: PasswordUpdatedResponseDto,
    description: 'Password updated; all sessions invalidated',
  })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Token invalid/expired or password too weak',
  })
  async confirmPasswordReset(
    @Body() dto: ConfirmPasswordResetDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ updated: true }> {
    const result = await this.resetPasswordUseCase.execute({
      rawToken: dto.token,
      newPassword: dto.newPassword,
    });
    if (result.isErr()) throw result.error;
    this.clearRefreshCookie(res);
    return { updated: true };
  }

  // ---- helpers ----

  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') !== 'dev',
      sameSite: this.cookieSameSite(),
      domain: this.config.get<string>('COOKIE_DOMAIN'),
      path: '/api/auth',
      signed: true,
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') !== 'dev',
      sameSite: this.cookieSameSite(),
      domain: this.config.get<string>('COOKIE_DOMAIN'),
      path: '/api/auth',
      signed: true,
    });
  }

  private cookieSameSite(): 'strict' | 'lax' | 'none' {
    const v = (this.config.get<string>('COOKIE_SAMESITE') ?? 'Strict').toLowerCase();
    return v === 'lax' ? 'lax' : v === 'none' ? 'none' : 'strict';
  }
}
