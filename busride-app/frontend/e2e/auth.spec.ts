import { expect, test } from '@playwright/test';
import { ADMIN, PASSWORD_PRUEBA, loginUi, sufijoUnico } from './utils/api';

/**
 * (a) Autenticación por la UI contra el backend real:
 * login del seed admin → /panel; registro de un pasajero nuevo (email único
 * por corrida) → /pasajero; logout desde el shell → /login.
 */
test.describe('Auth', () => {
  test('login del admin llega a /panel y logout vuelve a /login', async ({ page }) => {
    await loginUi(page, ADMIN.email, ADMIN.password);

    // Home del admin: /panel (redirige a usuarios) con el shell visible
    await expect(page).toHaveURL(/\/panel/);
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();

    // Logout desde la toolbar del shell
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('registro de pasajero nuevo entra a /pasajero', async ({ page }) => {
    const sufijo = sufijoUnico();

    await page.goto('/registro');
    await page.getByLabel('Nombre').fill('Pasajero');
    await page.getByLabel('Apellido').fill(`Registro ${sufijo}`);
    await page.getByLabel('Email').fill(`e2e.registro.${sufijo}@correo.com`);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD_PRUEBA);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // Registro + login automático → área del pasajero (buscar ruta)
    await expect(page).toHaveURL(/\/pasajero/);
    await expect(page.getByRole('button', { name: 'Buscar rutas' })).toBeVisible();

    // Logout también funciona para el pasajero
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
