import { request, type APIRequestContext, type APIResponse } from '@playwright/test';
import { ADMIN, API_URL } from './utils/api';

/**
 * Global setup de los e2e (registrado en playwright.config.ts).
 *
 * POR QUÉ EXISTE: el backend puede sembrar/marcar al admin con
 * `debeCambiarPassword=true` (cambio de contraseña obligatorio en el primer
 * login), pero TODOS los specs asumen la credencial documentada
 * (admin@busride.do / Admin123!cambiar) utilizable y sin flag pendiente.
 * Como el backend exige que la contraseña nueva sea DISTINTA de la actual,
 * no se puede "cambiarla a sí misma": se hace un cambio de ida y vuelta
 * (actual → temporal → actual). Cada cambio limpia el flag y rota los
 * tokens, así que al terminar la credencial original sigue vigente y el
 * flag queda en false para todos los specs existentes.
 */
export default async function globalSetup(): Promise<void> {
  const contexto = await request.newContext();
  try {
    const login = await contexto.post(`${API_URL}/auth/login`, { data: ADMIN });
    await asegurarOk(login, 'login admin');
    const sesion = (await login.json()) as {
      accessToken: string;
      usuario: { debeCambiarPassword?: boolean };
    };

    if (sesion.usuario.debeCambiarPassword !== true) {
      return; // nada pendiente: la credencial documentada ya sirve tal cual
    }

    const passwordTemporal = `${ADMIN.password}X`;

    // 1) actual → temporal (limpia el flag; devuelve un par de tokens NUEVO)
    const primerCambio = await cambiarPassword(contexto, sesion.accessToken, {
      passwordActual: ADMIN.password,
      passwordNueva: passwordTemporal,
    });

    // 2) temporal → actual, con el accessToken NUEVO (los refresh tokens
    //    viejos quedaron revocados): restaura la credencial documentada.
    await cambiarPassword(contexto, primerCambio.accessToken, {
      passwordActual: passwordTemporal,
      passwordNueva: ADMIN.password,
    });
  } finally {
    await contexto.dispose();
  }
}

async function cambiarPassword(
  contexto: APIRequestContext,
  accessToken: string,
  data: { passwordActual: string; passwordNueva: string },
): Promise<{ accessToken: string }> {
  const respuesta = await contexto.post(`${API_URL}/auth/cambiar-password`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data,
  });
  await asegurarOk(respuesta, 'cambiar password admin');
  return (await respuesta.json()) as { accessToken: string };
}

async function asegurarOk(respuesta: APIResponse, paso: string): Promise<void> {
  if (!respuesta.ok()) {
    throw new Error(
      `global-setup: falló ${paso} → ${respuesta.status()}: ${await respuesta.text()}`,
    );
  }
}
