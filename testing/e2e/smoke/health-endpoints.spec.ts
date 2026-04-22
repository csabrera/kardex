import { expect, test } from '@playwright/test';

import { apiGet } from '../../helpers/api.helper';

test.describe('Smoke — API health endpoints', () => {
  test('GET /health/live returns ok with uptime', async () => {
    // The health endpoint is outside the /api prefix — call it directly.
    const response = await apiGet('/../health/live');

    expect(response.status).toBe(200);

    const body = response.data as {
      data: { status: string; timestamp: string; uptime: number };
    };

    expect(body.data.status).toBe('ok');
    expect(body.data.timestamp).toBeDefined();
    expect(typeof body.data.uptime).toBe('number');
    expect(body.data.uptime).toBeGreaterThan(0);
  });

  test('GET /health returns database status ok', async () => {
    const response = await apiGet('/../health');

    expect(response.status).toBe(200);

    const body = response.data as {
      data: {
        status: string;
        info: Record<string, { status: string }>;
      };
    };

    expect(body.data.status).toBe('ok');
    expect(body.data.info?.database?.status).toBe('up');
  });
});
