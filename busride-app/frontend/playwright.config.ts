import { defineConfig, devices } from '@playwright/test';

/**
 * E2E del frontend BusRide (F-09) contra el backend REAL en
 * http://localhost:3002 (debe estar corriendo con la BD del contenedor).
 *
 * Playwright levanta `ng serve` (npm start, con proxy /api y /socket.io →
 * 3002) y lo cierra al terminar. Un solo worker: los specs comparten el
 * backend y siembran datos ÚNICOS por corrida (sufijo timestamp).
 *
 * Puerto 4310 (no el 4200 por defecto) para no chocar con un `ng serve` de
 * desarrollo que el usuario tenga abierto.
 */
const PUERTO = 4310;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: 'es-DO',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm start -- --port ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
