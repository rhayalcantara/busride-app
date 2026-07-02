import { expect, test } from '@playwright/test';
import {
  PUNTO_BASE,
  comprarPaqueteApi,
  get,
  loginApi,
  loginUi,
  post,
  registrarPasajeroApi,
  sembrarEscenario,
  sufijoUnico,
} from './utils/api';

/**
 * (c) Flujo del conductor por la UI contra el backend real:
 * con un escenario sembrado por API (SIN viaje iniciado), el conductor entra,
 * inicia el viaje desde su asignación y aborda a un pasajero pegando el
 * qrToken (fallback manual, sin cámara) hasta ver el ticket con el asiento.
 */
test.describe('Conductor', () => {
  test.use({
    geolocation: { latitude: PUNTO_BASE.lat, longitude: PUNTO_BASE.lng },
    permissions: ['geolocation'],
  });

  test('inicia viaje y aborda con token pegado', async ({ page, request }) => {
    const sufijo = sufijoUnico();
    const escenario = await sembrarEscenario(request, sufijo, { iniciarViaje: false });

    // Pasajero con saldo (sembrado por API) que reservará en el viaje
    const pasajero = await registrarPasajeroApi(request, sufijo);
    const tokenPasajero = await loginApi(request, pasajero.email, pasajero.password);
    await comprarPaqueteApi(request, tokenPasajero, sufijo);

    // ── UI: login del conductor → inicio con su asignación ──
    await loginUi(page, escenario.conductor.email, escenario.conductor.password);
    await expect(page).toHaveURL(/\/conductor/);
    await expect(page.getByRole('heading', { name: 'Mis asignaciones' })).toBeVisible();

    const cardAsignacion = page.locator('mat-card', { hasText: escenario.rutaNombre });
    await expect(cardAsignacion).toBeVisible();
    await cardAsignacion.getByRole('button', { name: 'Iniciar viaje' }).click();

    // Tras iniciar navega a la pantalla del viaje activo
    await expect(page).toHaveURL(/\/conductor\/viaje/);
    await expect(page.getByText('asientos libres')).toBeVisible();
    await expect(page.getByText(escenario.rutaNombre)).toBeVisible();

    // ── Por API: el pasajero reserva en el viaje recién iniciado → qrToken ──
    const tokenConductor = await loginApi(
      request,
      escenario.conductor.email,
      escenario.conductor.password,
    );
    const viaje = (await get(request, tokenConductor, '/viajes/mi-activo')) as { id: string };
    expect(viaje).not.toBeNull();

    const reserva = (await post(request, tokenPasajero, '/reservas', {
      viajeId: viaje.id,
      paradaOrigenId: escenario.paradas[0].id,
      paradaDestinoId: escenario.paradas[escenario.paradas.length - 1].id,
      latPasajero: PUNTO_BASE.lat,
      lngPasajero: PUNTO_BASE.lng,
    })) as { qrToken: string };
    expect(reserva.qrToken.length).toBeGreaterThan(20);

    // ── UI: abordar pegando el token (fallback manual, sin cámara) ──
    await page.goto('/conductor/abordar');
    await page.getByLabel('Token del QR').fill(reserva.qrToken);
    await page.getByRole('button', { name: 'Usar este token' }).click();

    await page.getByLabel('Número de asiento').fill('5');
    await page.getByRole('button', { name: 'Confirmar abordaje' }).click();

    // Éxito: ticket emitido con el asiento asignado
    await expect(page.getByText('¡Abordaje confirmado!')).toBeVisible();
    await expect(page.locator('.abordar__ticket-codigo')).not.toBeEmpty();
    await expect(page.locator('.abordar__ticket')).toContainText('Asiento');
    await expect(page.locator('.abordar__ticket')).toContainText('5');
  });
});
