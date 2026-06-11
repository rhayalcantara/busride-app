import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

// B3 (Ola 6): el ThrottlerGuard ya es global. Los e2e disparan cientos de
// requests en segundos desde la misma IP, así que se sube el límite vía env
// ANTES de compilar el AppModule (dotenv no pisa variables ya definidas).
process.env.THROTTLE_LIMIT = process.env.THROTTLE_LIMIT ?? '10000';

// Prefijo global idéntico al de main.ts
export const API = '/api/v1';

export const PASSWORD_E2E = 'Secreta123!';

// IDs de la tabla roles (seeds de 02_schema.sql): 1=admin, 2=asociacion, 3=conductor, 4=pasajero
export const ROL = {
  ADMIN: 1,
  ASOCIACION: 2,
  CONDUCTOR: 3,
  PASAJERO: 4,
} as const;

// Admin inicial sembrado por database/init/04_seed_admin.sql (B1, Ola 6):
// el registro público solo crea pasajeros, así que los e2e parten de este admin
// para crear usuarios con roles privilegiados vía POST /auth/usuarios.
export const ADMIN_SEED = {
  email: 'admin@busride.do',
  password: 'Admin123!cambiar',
} as const;

/**
 * Crea la app Nest para e2e replicando la configuración de main.ts
 * (prefijo global + ValidationPipe estricto). Los guards globales
 * (Throttler + JwtAuthGuard + RolesGuard) vienen del AppModule, no se registran aquí.
 *
 * IMPORTANTE: siempre cerrar con `await app.close()` en afterAll —
 * ScheduleModule está activo y el cron de reservas dejaría el proceso vivo.
 */
export async function crearAppE2E(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}

export interface SesionE2E {
  usuarioId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  rol: string;
}

/** Login de un usuario existente. */
export async function loguear(
  app: INestApplication,
  email: string,
  password: string = PASSWORD_E2E,
): Promise<SesionE2E> {
  const login = await request(app.getHttpServer())
    .post(`${API}/auth/login`)
    .send({ email, password })
    .expect(200);

  return {
    usuarioId: login.body.usuario?.id,
    email,
    accessToken: login.body.accessToken,
    refreshToken: login.body.refreshToken,
    rol: login.body.usuario?.rol,
  };
}

/** Login del admin sembrado en la BD (04_seed_admin.sql). */
export function loguearAdminSeed(app: INestApplication): Promise<SesionE2E> {
  return loguear(app, ADMIN_SEED.email, ADMIN_SEED.password);
}

/**
 * Registra un PASAJERO por el endpoint público (B1: ya no acepta rolId)
 * y lo loguea. Emails únicos por corrida: la BD puede tener datos previos.
 */
export async function registrarYLoguear(
  app: INestApplication,
  datos: { email: string; nombre: string; apellido: string },
): Promise<SesionE2E> {
  const reg = await request(app.getHttpServer())
    .post(`${API}/auth/registrar`)
    .send({ ...datos, password: PASSWORD_E2E })
    .expect(201);

  const sesion = await loguear(app, datos.email);
  return { ...sesion, usuarioId: reg.body.usuarioId };
}

/**
 * Crea un usuario con rol arbitrario vía POST /auth/usuarios (requiere token
 * de admin — B1) y lo loguea.
 */
export async function crearUsuarioYLoguear(
  app: INestApplication,
  adminAccessToken: string,
  datos: { email: string; nombre: string; apellido: string; rolId: number },
): Promise<SesionE2E> {
  const creado = await request(app.getHttpServer())
    .post(`${API}/auth/usuarios`)
    .set('Authorization', `Bearer ${adminAccessToken}`)
    .send({ ...datos, password: PASSWORD_E2E })
    .expect(201);

  const sesion = await loguear(app, datos.email);
  return { ...sesion, usuarioId: creado.body.usuarioId };
}

/** Compara UUIDs sin importar mayúsculas (SQL Server los devuelve en mayúsculas). */
export function mismoUuid(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}
