/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the build works both at a domain root and under a
  // sub-path such as https://<user>.github.io/<repo>/.
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
