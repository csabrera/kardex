import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetupDto } from './dto/setup.dto';
import { BusinessException } from '../../common/exceptions/business.exception';
import { BusinessErrorCode } from '@kardex/types';
import type { JwtPayload } from './strategies/jwt.strategy';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login con tipo + número de documento y contraseña' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Renovar access token usando refresh token (cookie)' })
  async refresh(@Req() req: Request) {
    const token = (req.cookies as Record<string, string>)[REFRESH_COOKIE];
    if (!token) {
      throw new BusinessException(
        BusinessErrorCode.REFRESH_TOKEN_EXPIRED,
        'No hay sesión activa',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return this.authService.refresh(token);
  }

  @Public()
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar sesión e invalidar refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string>)[REFRESH_COOKIE];
    if (token) {
      await this.authService.logout(token);
    }
    res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña por documento' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const isDev =
      (req as Request & { app: { get: (key: string) => string } }).app.get('env') ===
      'development';
    return this.authService.forgotPassword(dto, isDev);
  }

  @Public()
  @Post('reset-password/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resetear contraseña con token de recuperación' })
  async resetPassword(@Param('token') token: string, @Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(token, dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambiar contraseña (usuario autenticado)' })
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.sub, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado + permisos' })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }

  @Public()
  @Get('setup-status')
  @ApiOperation({ summary: 'Estado del wizard de configuración inicial' })
  getSetupStatus() {
    return this.authService.getSetupStatus();
  }

  @Public()
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wizard de configuración inicial (crea primer Admin)' })
  async setup(@Body() dto: SetupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.setup(dto);
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { accessToken: result.accessToken, user: result.user };
  }
}
