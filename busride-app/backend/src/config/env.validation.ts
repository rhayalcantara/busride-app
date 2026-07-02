/**
 * Validación fail-fast del entorno (INF-2, remediación de auditoría 2026-07-01).
 *
 * ConfigModule.forRoot({ validate }) la ejecuta al arrancar: si falta un
 * secreto o un valor es inválido, la app no levanta y el error dice exactamente
 * qué corregir (antes, un DB_PASSWORD ausente producía un error de conexión
 * opaco y un CORS_ORIGIN olvidado dejaba CORS abierto a '*' en producción).
 */

const VARS_NUMERICAS = [
  'DB_PORT',
  'PORT',
  'THROTTLE_LIMIT',
  'THROTTLE_TTL_MS',
  'REFRESH_TOKEN_DIAS',
] as const;

/** Secretos de desarrollo conocidos (commiteados históricamente) — jamás en producción. */
const SECRETOS_CONOCIDOS = [
  'busride-jwt-secret-change-in-production',
  'cambia-esto-en-produccion-usa-un-secreto-largo',
  'cambia-esto-usa-un-secreto-de-al-menos-32-caracteres',
];

export function validarEntorno(config: Record<string, unknown>): Record<string, unknown> {
  const errores: string[] = [];
  const esProduccion = config.NODE_ENV === 'production';

  if (!config.DB_PASSWORD) {
    errores.push('DB_PASSWORD es requerida (password del usuario de SQL Server)');
  }

  const jwtSecret = typeof config.JWT_SECRET === 'string' ? config.JWT_SECRET : '';
  if (!jwtSecret) {
    errores.push('JWT_SECRET es requerido (generar con: openssl rand -hex 32)');
  } else if (jwtSecret.length < 32) {
    errores.push('JWT_SECRET debe tener al menos 32 caracteres');
  } else if (esProduccion && SECRETOS_CONOCIDOS.includes(jwtSecret)) {
    errores.push('JWT_SECRET es un secreto de desarrollo conocido; genera uno propio para producción');
  }

  if (esProduccion) {
    const corsOrigin = typeof config.CORS_ORIGIN === 'string' ? config.CORS_ORIGIN.trim() : '';
    if (!corsOrigin || corsOrigin === '*') {
      errores.push(
        'CORS_ORIGIN es requerido en producción y no puede ser "*" (sin él, CORS queda abierto a cualquier origen con credentials)',
      );
    }
  }

  for (const variable of VARS_NUMERICAS) {
    const valor = config[variable];
    if (valor !== undefined && valor !== '' && Number.isNaN(Number(valor))) {
      errores.push(`${variable} debe ser numérica (recibido: "${String(valor)}")`);
    }
  }

  if (errores.length > 0) {
    throw new Error(`Configuración de entorno inválida:\n- ${errores.join('\n- ')}`);
  }

  return config;
}
