import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load testing/.env.local first (developer overrides), then testing/.env.example
// (committed defaults). dotenv ignores keys already present in process.env.
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env.example') });

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const CI = !!process.env.CI;

const STORAGE_STATE = path.join(__dirname, '.auth', 'admin.json');

export default defineConfig({
  testDir: './e2e',

  // Each test gets a reasonable timeout. Individual tests can override with test.setTimeout().
  timeout: 30_000,

  // Per-assertion timeout (expect(...).toBe(...))
  expect: { timeout: 5_000 },

  // Global setup: logs in once and saves storageState for authenticated tests.
  globalSetup: require.resolve('./global-setup.ts'),

  // Run tests in files in parallel; inside a file tests run serially.
  fullyParallel: true,

  // Fail the build if any test.only is left in CI.
  forbidOnly: CI,

  // Retry on CI to flush out flaky tests; locally show the failure immediately.
  retries: CI ? 2 : 0,

  // Opt out of parallel tests on CI to keep DB state predictable.
  workers: CI ? 1 : undefined,

  // Reporter — pretty list locally, full HTML + JSON on CI for artifacts.
  reporter: CI
    ? [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['junit', { outputFile: 'test-results/results.xml' }],
      ]
    : [['list'], ['html', { open: 'on-failure' }]],

  // Shared settings for all projects.
  use: {
    baseURL: WEB_URL,

    // Capture trace on first retry for debugging.
    trace: 'on-first-retry',

    // Screenshots on failure only.
    screenshot: 'only-on-failure',

    // Video on retry to debug flaky tests.
    video: 'retain-on-failure',

    // Ignore HTTPS errors (localhost self-signed certs).
    ignoreHTTPSErrors: true,

    // Sensible defaults for all actions.
    actionTimeout: 10_000,
    navigationTimeout: 15_000,

    // Spanish locale — the app is in Spanish.
    locale: 'es-PE',
    timezoneId: 'America/Lima',
  },

  // Browsers & devices to test against.
  projects: [
    // Auth-exercising tests (login/logout) — NO storageState; they start logged out.
    {
      name: 'auth-flows',
      testMatch: /auth\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Smoke + primary flows on Chromium, authenticated via saved storageState.
    {
      name: 'chromium',
      testIgnore: /auth\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE,
      },
    },

    // Full regression on Firefox + WebKit in CI only.
    ...(CI
      ? [
          {
            name: 'firefox',
            testIgnore: /auth\/.*\.spec\.ts/,
            use: {
              ...devices['Desktop Firefox'],
              storageState: STORAGE_STATE,
            },
          },
          {
            name: 'webkit',
            testIgnore: /auth\/.*\.spec\.ts/,
            use: {
              ...devices['Desktop Safari'],
              storageState: STORAGE_STATE,
            },
          },
        ]
      : []),

    // Mobile smoke (optional, opt-in with --project=mobile-chrome).
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        storageState: STORAGE_STATE,
      },
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],

  // Spawn dev servers automatically when running locally.
  // In CI we expect them to be started by the workflow.
  webServer: CI
    ? undefined
    : [
        {
          command: 'npm run dev --workspace=@kardex/api',
          url: `${API_URL}/health/live`,
          reuseExistingServer: true,
          timeout: 120_000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
        {
          command: 'npm run dev --workspace=@kardex/web',
          url: WEB_URL,
          reuseExistingServer: true,
          timeout: 120_000,
          stdout: 'ignore',
          stderr: 'pipe',
        },
      ],

  // Output directory for artifacts.
  outputDir: './test-results',
});
