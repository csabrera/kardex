import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('✅ Prisma connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('🛑 Prisma disconnected from database');
  }

  /**
   * Enables graceful shutdown of NestJS app on Prisma disconnect.
   */
  async enableShutdownHooks(app: INestApplication): Promise<void> {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }

  /**
   * Utility for integration tests: truncate all tables.
   * DO NOT call in production.
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase() is not allowed in production');
    }

    const modelNames = Reflect.ownKeys(this).filter(
      (key) => typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$'),
    );

    // Disable foreign key constraints temporarily
    await this.$executeRawUnsafe('SET CONSTRAINTS ALL DEFERRED');

    for (const modelName of modelNames) {
      try {
        const model = (
          this as unknown as Record<
            string,
            { deleteMany?: () => Promise<unknown> } | undefined
          >
        )[modelName as string];
        await model?.deleteMany?.();
      } catch {
        // Skip non-model properties
      }
    }
  }
}
