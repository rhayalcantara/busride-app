import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  API,
  ROL,
  SesionE2E,
  crearAppE2E,
  crearUsuarioYLoguear,
  loguearAdminSeed,
  registrarYLoguear,
} from './utils/e2e.helpers';

// UUID v4 arbitrario para probar rutas con :id sin tocar datos ajenos
const UUID_AJENO = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

/**
 * E2E de autorización: 401 (sin token / token inválido), 403 (rol incorrecto)
 * e IDOR bloqueado por diseño (las rutas viejas con :pasajeroId/:conductorId
 * ya no existen → 404; las nuevas /mias, /mi-saldo, /mi-activo derivan la
 * identidad del JWT y no aceptan IDs ajenos).
 */
describe('Autorización 401/403/IDOR (e2e)', () => {
  let app: INestApplication;
  const sufijo = Date.now();

  let pasajero: SesionE2E;
  let conductor: SesionE2E;

  beforeAll(async () => {
    app = await crearAppE2E();

    // B1: el registro público solo crea pasajeros; el conductor se crea con
    // el admin del seed (04_seed_admin.sql) vía POST /auth/usuarios.
    const admin = await loguearAdminSeed(app);

    [pasajero, conductor] = await Promise.all([
      registrarYLoguear(app, {
        email: `autz.pasajero.${sufijo}@busride.do`,
        nombre: 'Paula',
        apellido: 'Autz',
      }),
      crearUsuarioYLoguear(app, admin.accessToken, {
        email: `autz.conductor.${sufijo}@busride.do`,
        nombre: 'Camilo',
        apellido: 'Autz',
        rolId: ROL.CONDUCTOR,
      }),
    ]);
  });

  afterAll(async () => {
    // Obligatorio: ScheduleModule (cron de reservas) dejaría el proceso vivo
    await app.close();
  });

  describe('401 — sin token o token inválido', () => {
    const rutasProtegidas: Array<[string, string]> = [
      ['get', '/usuarios/me'],
      ['get', '/reservas/mias'],
      ['get', '/wallet/mi-saldo'],
      ['get', '/viajes/mi-activo'],
      ['get', '/liquidaciones/mias'],
    ];

    it.each(rutasProtegidas)('%s %s sin token → 401', async (metodo, ruta) => {
      await (request(app.getHttpServer()) as any)[metodo](`${API}${ruta}`).expect(401);
    });

    it('POST /viajes/iniciar sin token → 401', async () => {
      await request(app.getHttpServer())
        .post(`${API}/viajes/iniciar`)
        .send({ asignacionId: UUID_AJENO })
        .expect(401);
    });

    it('token manipulado → 401', async () => {
      await request(app.getHttpServer())
        .get(`${API}/usuarios/me`)
        .set('Authorization', `Bearer ${pasajero.accessToken}manipulado`)
        .expect(401);
    });
  });

  describe('403 — rol incorrecto (RolesGuard global)', () => {
    it('pasajero intenta POST /viajes/iniciar → 403', async () => {
      await request(app.getHttpServer())
        .post(`${API}/viajes/iniciar`)
        .set('Authorization', `Bearer ${pasajero.accessToken}`)
        .send({ asignacionId: UUID_AJENO })
        .expect(403);
    });

    it('conductor intenta GET /usuarios (solo admin) → 403', async () => {
      await request(app.getHttpServer())
        .get(`${API}/usuarios`)
        .set('Authorization', `Bearer ${conductor.accessToken}`)
        .expect(403);
    });

    it('pasajero intenta PATCH /liquidaciones/:id/pagar (solo admin) → 403', async () => {
      await request(app.getHttpServer())
        .patch(`${API}/liquidaciones/${UUID_AJENO}/pagar`)
        .set('Authorization', `Bearer ${pasajero.accessToken}`)
        .send({ referenciaPago: 'REF-AUTZ-E2E' })
        .expect(403);
    });

    it('conductor intenta POST /wallet/comprar (solo pasajero) → 403', async () => {
      await request(app.getHttpServer())
        .post(`${API}/wallet/comprar`)
        .set('Authorization', `Bearer ${conductor.accessToken}`)
        .send({ paqueteId: 1, referenciaExterna: `PAY-AUTZ-${sufijo}` })
        .expect(403);
    });

    it('conductor intenta POST /reservas (solo pasajero) → 403', async () => {
      await request(app.getHttpServer())
        .post(`${API}/reservas`)
        .set('Authorization', `Bearer ${conductor.accessToken}`)
        .send({
          viajeId: UUID_AJENO,
          paradaOrigenId: 1,
          paradaDestinoId: 2,
          latPasajero: 18.48,
          lngPasajero: -69.93,
        })
        .expect(403);
    });

    it('pasajero intenta POST /asociaciones (solo admin) → 403', async () => {
      await request(app.getHttpServer())
        .post(`${API}/asociaciones`)
        .set('Authorization', `Bearer ${pasajero.accessToken}`)
        .send({ usuarioId: pasajero.usuarioId, nombre: 'Intrusa E2E' })
        .expect(403);
    });
  });

  describe('IDOR bloqueado por diseño — las rutas viejas con :pasajeroId/:conductorId ya no existen', () => {
    // Antes de la Ola 3 estas rutas aceptaban el ID de OTRO usuario en la URL.
    // Hoy la identidad se deriva del JWT (/mias, /mi-saldo, /mi-activo) y las
    // rutas viejas deben responder 404 incluso con token válido.
    const rutasViejas: Array<[string, string, string]> = [
      ['get', `/reservas/pasajero/${UUID_AJENO}`, 'reservas por pasajeroId'],
      ['get', `/wallet/${UUID_AJENO}`, 'wallet por pasajeroId'],
      ['post', `/wallet/${UUID_AJENO}/comprar`, 'comprar con pasajeroId'],
      ['get', `/wallet/${UUID_AJENO}/historial`, 'historial por pasajeroId'],
      ['get', `/viajes/conductor/${UUID_AJENO}/activo`, 'viaje activo por conductorId'],
      ['get', `/liquidaciones/conductor/${UUID_AJENO}`, 'liquidaciones por conductorId'],
    ];

    it.each(rutasViejas)('%s %s (%s) → 404', async (metodo, ruta) => {
      await (request(app.getHttpServer()) as any)
        [metodo](`${API}${ruta}`)
        .set('Authorization', `Bearer ${pasajero.accessToken}`)
        .expect(404);
    });
  });
});
