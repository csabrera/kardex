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
import { Throttle } from '@nestjs/throttler';
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
// Session cookie — SIN maxAge ni expires. El navegador la elimina al cerrar.
// Esto fuerza re-login cuando el usuario cierra el navegador completo, alineado
// con el modelo de seguridad esperado por el cliente.
//
// Nota: el refresh token en BD sigue vigente JWT_REFRESH_EXPIRES_IN (7d por
// default), así que múltiples tabs/ventanas del MISMO navegador comparten la
// cookie y la sesión sigue viva entre ellas hasta cerrar todas las ventanas.
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
  // Brute-force protection: 5 intentos por IP cada 15 min.
  // El override (sobrescribe el global 60/min) usa el mismo nombre 'global'.
  @Throttle({ global: { limit: 5, ttl: 900_000 } })
  @ApiOperation({ summary: 'Login con tipo + número de documento y contraseña' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    // Session cookie: sin maxAge → se borra al cerrar navegador.
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
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
  // Anti-enumeración/anti-spam: 3 intentos por IP por hora.
  @Throttle({ global: { limit: 3, ttl: 3_600_000 } })
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
    // Session cookie: sin maxAge → se borra al cerrar navegador.
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    return { accessToken: result.accessToken, user: result.user };
  }
}
