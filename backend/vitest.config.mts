import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Apaga os bancos clinica_test* antes e depois da suíte (TST-01).
    globalSetup: ['tests/helpers/global-setup.ts'],
  },
});
