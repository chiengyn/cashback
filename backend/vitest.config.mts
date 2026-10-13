import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // Integration test dùng chung một database nên chạy tuần tự.
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://postgres:test@localhost:55432/hoantien',
      CRON_SECRET: 'test-cron-secret-0123456789',
      AUTH_SECRET: 'test-auth-secret-0123456789',
      ADMIN_PASSWORD: 'test-admin-password',
      AFFILIATE_MODE: 'mock',
      MIN_WITHDRAWAL: '10000',
      APPROVAL_HOLD_DAYS: '30',
    },
  },
});
