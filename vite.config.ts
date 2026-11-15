/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' gør at appen virker både lokalt og på GitHub Pages (/workout-tracker/)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'] },
});
