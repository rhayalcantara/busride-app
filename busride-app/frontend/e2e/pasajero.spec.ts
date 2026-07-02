import { expect, test } from '@playwright/test';
import {
  PUNTO_BASE,
  loginUi,
  registrarPasajeroApi,
  sembrarEscenario,
  sufijoUnico,
} from './utils/api';

/**
 * (b) Flujo del pasajero por la UI contra el backend real:
 * con un escenario sembrado por API (asociación → conductor → bus → ruta con
 * paradas alrededor de PUNTO_BASE → asignación → viaje EN_CURSO), un pasajero
 * recién registrado compra un paquete en la wallet (el saldo se refleja),
 * busca la ruta en el mapa (geolocation en PUNTO_BASE) y reserva hasta ver el
 * QR de abordaje en pantalla.
 */
test.describe('Pasajero', () => {
  test.use({
    geolocation: { latitude: PUNTO_BASE.lat, longitude: PUNTO_BASE.lng },
    permissions: ['geolocation'],
  });

  test('compra paquete, busca ruta y reserva hasta ver el QR', async ({ page, request }) => {
    const sufijo = sufijoUnico();

    // Siembra por API: escenario completo con viaje EN_CURSO
    const escenario = await sembrarEscenario(request, sufijo, { iniciarViaje: true });
    const pasajero = await registrarPasajeroApi(request, sufijo);

    await loginUi(page, pasajero.email, pasajero.password);
    await expect(page).toHaveURL(/\/pasajero/);

    // ── Wallet: saldo inicial 0 → comprar el Paquete Básico → saldo 10 ──
    await page.goto('/pasajero/wallet');
    const saldoViajes = page.locator('.wallet__saldo-valor').first();
    await expect(saldoViajes).toHaveText('0');

    const cardPaquete = page.locator('.wallet__paquete', { hasText: 'Paquete Básico' });
    await cardPaquete.getByRole('button', { name: 'Comprar' }).click();
    // Diálogo de confirmación de la compra
    await page.getByRole('dialog').getByRole('button', { name: 'Comprar' }).click();

    await expect(page.getByText('¡Compra exitosa!')).toBeVisible();
    await expect(saldoViajes).toHaveText('10'); // 10 viajes, 0 de bono

    // ── Buscar ruta: origen = mi ubicación (PUNTO_BASE), destino por clic ──
    await page.goto('/pasajero');
    const mapa = page.locator('app-mapa');
    await expect(mapa).toBeVisible();

    // Clic ~100 px al sureste del centro ≈ ~900 m, cerca de la última parada
    const caja = await mapa.boundingBox();
    if (!caja) throw new Error('El mapa no tiene bounding box');
    await mapa.click({ position: { x: caja.width / 2 + 100, y: caja.height / 2 + 100 } });

    // Radio de búsqueda amplio para absorber la imprecisión del clic
    await page.getByLabel('Radio de búsqueda').click();
    await page.getByRole('option', { name: '2000 m' }).click();

    await page.getByRole('button', { name: 'Buscar rutas' }).click();

    // Resultado: la card de NUESTRA ruta (datos únicos por corrida)
    const cardRuta = page.locator('.buscar__card', { hasText: escenario.rutaNombre });
    await expect(cardRuta).toBeVisible();
    await cardRuta.click();

    // Detalle con tarifa y botón Reservar
    await expect(page.getByText('Tarifa:')).toBeVisible();
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();

    // ── Reservar: paradas preseleccionadas desde la búsqueda → QR ──
    await expect(page).toHaveURL(/\/pasajero\/reservar/);
    await page.getByRole('button', { name: 'Reservar y generar QR' }).click();

    await expect(page.getByAltText('Código QR de abordaje')).toBeVisible();
    // Countdown de 5:00 en marcha (m:ss); el texto renderizado lleva espacios
    await expect(page.locator('.reservar__countdown')).toHaveText(/^\s*[0-5]:\d{2}\s*$/);
  });
});
