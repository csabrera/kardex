import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 4000;
  const host = configService.get<string>('app.host') ?? 'localhost';
  const corsOrigin = configService.get<string>('app.corsOrigin') ?? 'http://localhost:3000';
  const env = configService.get<string>('app.env') ?? 'development';

  // ===========================================================================
  // Security
  // ===========================================================================
  app.use(
    helmet({
      contentSecurityPolicy: env === 'production',
      crossOriginEmbedderPolicy: env === 'production',
    }),
  );

  // ===========================================================================
  // CORS
  // ===========================================================================
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ===========================================================================
  // Global validation pipe
  // ===========================================================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ===========================================================================
  // Global API prefix
  // ===========================================================================
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live'] });

  // ===========================================================================
  // Prisma graceful shutdown
  // ===========================================================================
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  // ===========================================================================
  // Swagger (disabled in production by default)
  // ===========================================================================
  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Kardex API')
      .setDescription(
        'API del Sistema de Kardex para Empresa Constructora.\n\n' +
          'Autenticación por tipo de documento (DNI / CE / PASAPORTE) + contraseña.',
      )
      .setVersion('0.1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token obtenido desde POST /api/auth/login',
        },
        'access-token',
      )
      .addTag('auth', 'Autenticación y gestión de sesión')
      .addTag('users', 'Usuarios')
      .addTag('roles', 'Roles y permisos')
      .addTag('warehouses', 'Almacenes y obras')
      .addTag('items', 'Catálogo de ítems')
      .addTag('stock', 'Stock por almacén')
      .addTag('movements', 'Movimientos de inventario')
      .addTag('transfers', 'Transferencias entre almacenes')
      .addTag('health', 'Health checks')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // ===========================================================================
  // Start server
  // ===========================================================================
  await app.listen(port, host);

  const url = `http://${host}:${port}`;
  // eslint-disable-next-line no-console
  console.log(`\n🚀 Kardex API running at ${url}`);
  // eslint-disable-next-line no-console
  console.log(`   Environment: ${env}`);
  // eslint-disable-next-line no-console
  console.log(`   Health:      ${url}/health`);
  if (env !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`   Swagger:     ${url}/docs`);
  }
  // eslint-disable-next-line no-console
  console.log(`   CORS Origin: ${corsOrigin}\n`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('❌ Failed to start Kardex API:', err);
  process.exit(1);
});
