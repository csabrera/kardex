import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  API_PORT = 4000;

  @IsString()
  @IsOptional()
  // En producción (Railway, Docker, K8s) bindeamos a 0.0.0.0 para escuchar
  // todas las interfaces — `localhost` no es alcanzable desde fuera del
  // contenedor y rompe el healthcheck del proxy. En local default localhost.
  API_HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  REDIS_URL?: string;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN = '7d';

  @IsUrl({ require_tld: false })
  @IsOptional()
  CORS_ORIGIN = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  LOG_LEVEL = 'debug';

  // Optional admin bootstrap vars
  @IsOptional()
  @IsString()
  ADMIN_DOC_TYPE?: string;

  @IsOptional()
  @IsString()
  ADMIN_DOC_NUMBER?: string;

  @IsOptional()
  @IsString()
  ADMIN_PASSWORD?: string;

  @IsOptional()
  @IsString()
  ADMIN_FIRST_NAME?: string;

  @IsOptional()
  @IsString()
  ADMIN_LAST_NAME?: string;

  @IsOptional()
  @IsString()
  ADMIN_EMAIL?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }

  return validatedConfig;
}
