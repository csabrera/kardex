import { Test, TestingModule } from '@nestjs/testing';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: 'HealthCheckService', useValue: {} },
        { provide: 'PrismaHealthIndicator', useValue: {} },
        { provide: 'PrismaService', useValue: {} },
        { provide: 'HttpHealthIndicator', useValue: {} },
      ],
    })
      .overrideProvider(HealthController)
      .useValue(
        new HealthController(
          {} as never,
          {} as never,
          {} as never,
          {} as never,
        ),
      )
      .compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('liveness', () => {
    it('should return status ok with uptime', () => {
      const result = controller.liveness();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.uptime).toBe('number');
    });
  });
});
