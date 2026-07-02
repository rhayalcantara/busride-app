import { expect, test } from '@playwright/test';
import {
  ADMIN,
  PASSWORD_PRUEBA,
  ROL_ID,
  loginApi,
  loginUi,
  patch,
  post,
  sufijoUnico,
} from './utils/api';

/**
 * (d) Panel admin por la UI contra el backend real:
 * con una asociación ACTIVA sembrada por API, el admin entra al panel,
 * navega a Flota y registra un bus desde la UI → aparece en el listado.
 */
test.describe('Panel admin', () => {
  test('crea un bus desde la UI y aparece en el listado', async ({ page, request }) => {
    const sufijo = sufijoUnico();

    // Siembra mínima: usuario asociación → asociación → aprobar (queda ACTIVA)
    const admin = await loginApi(request, ADMIN.email, ADMIN.password);
    const usuario = (await post(request, admin, '/auth/usuarios', {
      email: `e2e.panel.${sufijo}@busride.do`,
      password: PASSWORD_PRUEBA,
      nombre: 'Panel',
      apellido: `E2E ${sufijo}`,
      rolId: ROL_ID.asociacion,
    })) as { usuarioId: string };
    // rnc único SIEMPRE: la columna UNIQUE de SQL Server solo admite un null
    const asociacion = (await post(request, admin, '/asociaciones', {
      usuarioId: usuario.usuarioId,
      nombre: `Asociación Panel E2E ${sufijo}`,
      rnc: `PNL-${sufijo}`,
    })) as { id: string };
    await patch(request, admin, `/asociaciones/${asociacion.id}/aprobar`, {});

    // ── UI: login admin → Flota ──
    await loginUi(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/panel/);

    await page.getByRole('link', { name: 'Flota' }).click();
    await expect(page).toHaveURL(/\/panel\/flota/);

    // Espera a que el contexto de asociación esté resuelto (selector con valor)
    await expect(page.getByLabel('Asociación')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar bus' })).toBeVisible();

    // ── Crear bus desde el diálogo ──
    const placa = `UI-${sufijo}`;
    await page.getByRole('button', { name: 'Registrar bus' }).click();
    const dialogo = page.getByRole('dialog');
    await dialogo.getByLabel('Placa').fill(placa);
    await dialogo.getByLabel('Capacidad total (asientos)').fill('25');
    await dialogo.getByRole('button', { name: 'Registrar', exact: true }).click();

    // El diálogo se cierra y el bus aparece en el listado de la pestaña Buses
    await expect(dialogo).toBeHidden();
    await expect(page.locator('app-tabla-paginada')).toContainText(placa);
  });
});
