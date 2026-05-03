import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  OAUTH_STATE_STORE,
  type IOAuthStateStore,
} from '../../domain/ports/oauth-state-store.port';
import { HandleOAuthCallbackUseCase } from '../../application/use-cases/handle-oauth-callback.use-case';
import { AccountLinkRequiredError, OAuthStateMismatchError } from '../../domain/errors/auth.errors';
import type { OAuthProfile } from '../../domain/value-objects/oauth-profile';

const REFRESH_COOKIE = 'refresh';

const PROVIDERS = ['google', 'github'] as const;
type Provider = (typeof PROVIDERS)[number];

@ApiTags('Auth · OAuth')
@Controller('auth')
export class OAuthController {
  constructor(
    @Inject(OAUTH_STATE_STORE) private readonly stateStore: IOAuthStateStore,
    private readonly callbackUseCase: HandleOAuthCallbackUseCase,
    private readonly config: ConfigService,
  ) {}

  /**
   * Inicia el flow OAuth. Si llega un access JWT en Authorization, ese userId queda
   * almacenado en el state para linking. Si no, es un new-login flow.
   *
   * Por simplicidad pre-genera el state y luego deja que Passport haga redirect.
   */
  @Get(':provider')
  @ApiOperation({ summary: 'Start OAuth flow with the named provider (google|github)' })
  async start(
    @Param('provider') provider: Provider,
    @Req() req: Request & { user?: { userId?: string } },
    @Res() res: Response,
  ): Promise<void> {
    if (!PROVIDERS.includes(provider)) {
      res.status(400).json({ code: 'INVALID_PROVIDER' });
      return;
    }
    const linkUserId = req.user?.userId ?? null;
    const state = await this.stateStore.issue({ provider, linkUserId });

    const url = this.buildAuthorizationUrl(provider, state);
    res.redirect(302, url);
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OAuth Google callback' })
  async googleCallback(
    @Req() req: Request & { user?: OAuthProfile },
    @Query('state') state: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.handleCallback('google', req, state, res);
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OAuth GitHub callback' })
  async githubCallback(
    @Req() req: Request & { user?: OAuthProfile },
    @Query('state') state: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.handleCallback('github', req, state, res);
  }

  // ---- helpers ----

  private async handleCallback(
    provider: Provider,
    req: Request & { user?: OAuthProfile },
    state: string,
    res: Response,
  ): Promise<{
    accessToken: string;
    accessTokenExpiresInSec: number;
    userId: string;
    sessionId: string;
    created: boolean;
    linked: boolean;
  }> {
    const payload = await this.stateStore.consume(state);
    if (!payload || payload.provider !== provider) {
      throw new OAuthStateMismatchError();
    }
    const profile = req.user;
    if (!profile) throw new AccountLinkRequiredError();

    const result = await this.callbackUseCase.execute({
      profile,
      authenticatedUserId: payload.linkUserId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if (result.isErr()) throw result.error;

    res.cookie(REFRESH_COOKIE, result.value.refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') !== 'dev',
      sameSite: this.cookieSameSite(),
      domain: this.config.get<string>('COOKIE_DOMAIN'),
      path: '/api/auth',
      signed: true,
      expires: result.value.refreshTokenExpiresAt,
    });

    return {
      accessToken: result.value.accessToken,
      accessTokenExpiresInSec: result.value.accessTokenExpiresInSec,
      userId: result.value.userId,
      sessionId: result.value.sessionId,
      created: result.value.created,
      linked: result.value.linked,
    };
  }

  private buildAuthorizationUrl(provider: Provider, state: string): string {
    const cb =
      provider === 'google'
        ? this.config.get<string>('GOOGLE_CALLBACK_URL')
        : this.config.get<string>('GITHUB_CALLBACK_URL');
    const clientId =
      provider === 'google'
        ? this.config.get<string>('GOOGLE_CLIENT_ID')
        : this.config.get<string>('GITHUB_CLIENT_ID');

    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: clientId ?? '',
        redirect_uri: cb ?? '',
        response_type: 'code',
        scope: 'email profile',
        state,
        access_type: 'offline',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    const params = new URLSearchParams({
      client_id: clientId ?? '',
      redirect_uri: cb ?? '',
      scope: 'user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  private cookieSameSite(): 'strict' | 'lax' | 'none' {
    const v = (this.config.get<string>('COOKIE_SAMESITE') ?? 'Strict').toLowerCase();
    return v === 'lax' ? 'lax' : v === 'none' ? 'none' : 'strict';
  }
}
