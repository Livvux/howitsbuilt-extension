import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    globals: true,
    setupFiles: ['test/setup.ts'],
    include: ['test/**/*.test.ts'],
    environmentOptions: { happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: true } } },
  },
});
