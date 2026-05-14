import 'reflect-metadata';

import { AuthController } from './auth.controller';
import { HealthController } from '../health/health.controller';

/**
 * Verifica que la metadata del rate-limit está aplicada correctamente en los
 * endpoints sensibles.
 *
 * `@nestjs/throttler` concatena el nombre del throttler al final de la clave
 * de metadata. `@Throttle({ global: { limit, ttl } })` guarda en
 * `THROTTLER:LIMITglobal` y `THROTTLER:TTLglobal`. `@SkipThrottle()` sin args
 * usa el nombre por default y guarda en `THROTTLER:SKIPdefault`.
 *
 * NOTA: las constantes (`THROTTLER_LIMIT`, etc.) NO están re-exportadas desde
 * el barrel `@nestjs/throttler`. Hardcodeamos los strings — son estables y
 * documentados.
 *
 * La cuota global (60/min) viene de `ThrottlerModule.forRoot` en AppModule.
 * Estos tests solo verifican los OVERRIDES por endpoint.
 */
describe('Throttler — metadata por endpoint', () => {
  const KEY_LIMIT_GLOBAL = 'THROTTLER:LIMITglobal';
  const KEY_TTL_GLOBAL = 'THROTTLER:TTLglobal';
  const KEY_SKIP_DEFAULT = 'THROTTLER:SKIPdefault';

  it('AuthController.login override: 5 intentos / 15 min', () => {
    const fn = AuthController.prototype.login;
    expect(Reflect.getMetadata(KEY_LIMIT_GLOBAL, fn)).toBe(5);
    expect(Reflect.getMetadata(KEY_TTL_GLOBAL, fn)).toBe(900_000);
  });

  it('AuthController.forgotPassword override: 3 intentos / 1 hora', () => {
    const limit = Reflect.getMetadata(
      KEY_LIMIT_GLOBAL,
      AuthController.prototype.forgotPassword,
    );
    const ttl = Reflect.getMetadata(
      KEY_TTL_GLOBAL,
      AuthController.prototype.forgotPassword,
    );
    expect(limit).toBe(3);
    expect(ttl).toBe(3_600_000);
  });

  it('HealthController salta throttle (SkipThrottle a nivel de clase)', () => {
    const skip = Reflect.getMetadata(KEY_SKIP_DEFAULT, HealthController);
    expect(skip).toBe(true);
  });

  it('AuthController.refresh y .logout usan el límite global (sin override)', () => {
    // Sin @Throttle override → fallback al default 60/min de ThrottlerModule.
    expect(
      Reflect.getMetadata(KEY_LIMIT_GLOBAL, AuthController.prototype.refresh),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(KEY_LIMIT_GLOBAL, AuthController.prototype.logout),
    ).toBeUndefined();
  });
});
