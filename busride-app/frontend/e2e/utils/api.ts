import { APIRequestContext, Page, expect } from '@playwright/test';

/** API real del backend (sin pasar por el proxy de ng serve: más estable para sembrar). */
export const API_URL = 'http://localhost:3002/api/v1';

export const ADMIN = { email: 'admin@busride.do', password: 'Admin123!cambiar' };
export const PASSWORD_PRUEBA = 'Prueba123!segura';

/** Punto fijo de los escenarios geoespaciales (Santo Domingo). */
export const PUNTO_BASE = { lat: 18.4861, lng: -69.9312 };

/** Roles según el seed de la BD (orden de inserción en 02_schema.sql). */
export const ROL_ID = { admin: 1, asociacion: 2, conductor: 3, pasajero: 4 } as const;

// ───────────────────────── HTTP helpers ─────────────────────────

async function pedir(
  request: APIRequestContext,
  metodo: 'post' | 'patch' | 'get',
  ruta: string,
  token?: string,
  data?: unknown,
): Promise<unknown> {
  const respuesta = await request[metodo](`${API_URL}${ruta}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    data: data as Record<string, unknown> | undefined,
  });
  if (!respuesta.ok()) {
    throw new Error(`${metodo.toUpperCase()} ${ruta} → ${respuesta.status()}: ${await respuesta.text()}`);
  }
  return respuesta.json();
}

export const post = (r: APIRequestContext, token: string, ruta: string, data: unknown) =>
  pedir(r, 'post', ruta, token, data);
export const patch = (r: APIRequestContext, token: string, ruta: string, data: unknown) =>
  pedir(r, 'patch', ruta, token, data);
export const get = (r: APIRequestContext, token: string, ruta: string) =>
  pedir(r, 'get', ruta, token);

/** Login por API; devuelve el accessToken. */
export async function loginApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const respuesta = (await pedir(request, 'post', '/auth/login', undefined, {
    email,
    password,
  })) as { accessToken: string };
  return respuesta.accessToken;
}

// ───────────────────────── Siembra de escenario ─────────────────────────

export interface EscenarioSembrado {
  sufijo: string;
  asociacionId: string;
  conductor: { email: string; password: string; conductorId: string };
  busId: string;
  rutaId: string;
  rutaNombre: string;
  asignacionId: string;
  paradas: { id: number; nombre: string; orden: number; lat: number; lng: number }[];
  /** Solo si se pidió iniciar el viaje. */
  viajeId?: string;
}

/**
 * Siembra por API (patrón de las demos curl de F-06/F-07): usuario asociación →
 * asociación aprobada → usuario conductor → conductor → bus → ruta con paradas
 * alrededor de PUNTO_BASE → asignación; opcionalmente inicia el viaje como el
 * conductor y publica una posición inicial. Datos únicos por `sufijo`.
 */
export async function sembrarEscenario(
  request: APIRequestContext,
  sufijo: string,
  opciones: { iniciarViaje: boolean },
): Promise<EscenarioSembrado> {
  const admin = await loginApi(request, ADMIN.email, ADMIN.password);

  // 1) Usuario administrador de la asociación + asociación aprobada
  const usuarioAsoc = (await post(request, admin, '/auth/usuarios', {
    email: `e2e.asoc.${sufijo}@busride.do`,
    password: PASSWORD_PRUEBA,
    nombre: 'Asociación',
    apellido: `E2E ${sufijo}`,
    rolId: ROL_ID.asociacion,
  })) as { usuarioId: string };

  // OJO: rnc SIEMPRE y único — la columna tiene UNIQUE en SQL Server, que solo
  // admite UN null: una segunda asociación sin rnc revienta con 500 (deuda
  // backend documentada en F-09; máx. 20 caracteres).
  const asociacion = (await post(request, admin, '/asociaciones', {
    usuarioId: usuarioAsoc.usuarioId,
    nombre: `Asociación E2E ${sufijo}`,
    rnc: `E2E-${sufijo}`,
    comisionPct: 5,
  })) as { id: string };
  await patch(request, admin, `/asociaciones/${asociacion.id}/aprobar`, {});

  // 2) Conductor (usuario + perfil con licencia)
  const emailConductor = `e2e.conductor.${sufijo}@busride.do`;
  const usuarioConductor = (await post(request, admin, '/auth/usuarios', {
    email: emailConductor,
    password: PASSWORD_PRUEBA,
    nombre: 'Conductor',
    apellido: `E2E ${sufijo}`,
    rolId: ROL_ID.conductor,
  })) as { usuarioId: string };

  const altaConductor = (await post(request, admin, '/conductores', {
    usuarioId: usuarioConductor.usuarioId,
    asociacionId: asociacion.id,
    licenciaNumero: `LIC-E2E-${sufijo}`,
    licenciaVence: '2030-12-31',
  })) as { conductor: { id: string } };
  const conductor = altaConductor.conductor;

  // 3) Bus
  const bus = (await post(request, admin, '/flota/buses', {
    asociacionId: asociacion.id,
    placa: `E2E-${sufijo}`,
    capacidadTotal: 20,
  })) as { id: string };

  // 4) Ruta con 3 paradas alrededor del punto base (~500 m entre sí)
  const rutaNombre = `Ruta E2E ${sufijo}`;
  const ruta = (await post(request, admin, '/rutas', {
    asociacionId: asociacion.id,
    nombre: rutaNombre,
    tarifa: 50,
    paradas: [
      { nombre: 'Terminal Norte E2E', orden: 1, lat: PUNTO_BASE.lat, lng: PUNTO_BASE.lng, esTerminal: true },
      { nombre: 'Parada Centro E2E', orden: 2, lat: PUNTO_BASE.lat - 0.0045, lng: PUNTO_BASE.lng + 0.0045 },
      { nombre: 'Terminal Sur E2E', orden: 3, lat: PUNTO_BASE.lat - 0.009, lng: PUNTO_BASE.lng + 0.009, esTerminal: true },
    ],
  })) as { id: string };

  const paradas = (await get(request, admin, `/rutas/${ruta.id}/paradas`)) as {
    id: number;
    nombre: string;
    orden: number;
    lat: number;
    lng: number;
  }[];

  // 5) Asignación bus-ruta-conductor
  const asignacion = (await post(request, admin, '/flota/asignaciones', {
    busId: bus.id,
    rutaId: ruta.id,
    conductorId: conductor.id,
  })) as { id: string };

  const escenario: EscenarioSembrado = {
    sufijo,
    asociacionId: asociacion.id,
    conductor: { email: emailConductor, password: PASSWORD_PRUEBA, conductorId: conductor.id },
    busId: bus.id,
    rutaId: ruta.id,
    rutaNombre,
    asignacionId: asignacion.id,
    paradas: [...paradas].sort((a, b) => a.orden - b.orden),
  };

  // 6) Opcional: el conductor inicia el viaje y publica posición inicial
  if (opciones.iniciarViaje) {
    const tokenConductor = await loginApi(request, emailConductor, PASSWORD_PRUEBA);
    const viaje = (await post(request, tokenConductor, '/viajes/iniciar', {
      asignacionId: asignacion.id,
    })) as { id: string };
    await patch(request, tokenConductor, `/viajes/${viaje.id}/posicion`, PUNTO_BASE);
    escenario.viajeId = viaje.id;
  }

  return escenario;
}

/** Registra un pasajero nuevo por API y devuelve sus credenciales. */
export async function registrarPasajeroApi(
  request: APIRequestContext,
  sufijo: string,
): Promise<{ email: string; password: string }> {
  const email = `e2e.pasajero.${sufijo}@correo.com`;
  await pedir(request, 'post', '/auth/registrar', undefined, {
    email,
    password: PASSWORD_PRUEBA,
    nombre: 'Pasajera',
    apellido: `E2E ${sufijo}`,
  });
  return { email, password: PASSWORD_PRUEBA };
}

/** Compra el primer paquete del catálogo por API (acredita saldo de viajes). */
export async function comprarPaqueteApi(
  request: APIRequestContext,
  tokenPasajero: string,
  sufijo: string,
): Promise<void> {
  const paquetes = (await get(request, tokenPasajero, '/wallet/paquetes')) as { id: string }[];
  await post(request, tokenPasajero, '/wallet/comprar', {
    paqueteId: paquetes[0].id,
    referenciaExterna: `E2E-PAGO-${sufijo}`,
  });
}

// ───────────────────────── UI helpers ─────────────────────────

/** Login por la UI: rellena el formulario de /login y espera salir de él. */
export async function loginUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Sufijo único por corrida (lección del backend: datos únicos siempre). */
export function sufijoUnico(): string {
  return `${Date.now()}`;
}
