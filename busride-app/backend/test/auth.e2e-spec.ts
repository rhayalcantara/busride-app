import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { API, PASSWORD_E2E, ROL, crearAppE2E, loguearAdminSeed } from './utils/e2e.helpers';

/**
 * E2E de autenticación: registro, login, rotación de refresh tokens y logout.
 * Usa emails únicos por corrida (sufijo Date.now()) — la BD puede tener datos previos.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  const sufijo = Date.now();
  const email = `auth.e2e.${sufijo}@busride.do`;

  // Estado compartido entre pasos secuenciales (--runInBand)
  let usuarioId: string;
  let accessToken: string;
  let refreshToken: string;
  let accessTokenRotado: string;
  let refreshTokenRotado: string;

  beforeAll(async () => {
    app = await crearAppE2E();
  });

  afterAll(async () => {
    // Obligatorio: ScheduleModule (cron de reservas) dejaría el proceso vivo
    await app.close();
  });

  describe('POST /auth/registrar (público, siempre pasajero — B1)', () => {
    it('registra un pasajero nuevo → 201 con usuarioId', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/auth/registrar`)
        .send({
          email,
          password: PASSWORD_E2E,
          nombre: 'Ana',
          apellido: 'E2E',
        })
        .expect(201);

      expect(res.body.usuarioId).toBeDefined();
      expect(res.body.mensaje).toContain('registrado');
      usuarioId = res.body.usuarioId;
    });

    it('email duplicado → 409', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/auth/registrar`)
        .send({
          email,
          password: PASSWORD_E2E,
          nombre: 'Ana',
          apellido: 'Duplicada',
        })
        .expect(409);

      expect(res.body.message).toContain('ya está registrado');
    });

    it('email con formato inválido → 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/auth/registrar`)
        .send({
          email: 'no-es-un-email',
          password: PASSWORD_E2E,
          nombre: 'Ana',
          apellido: 'E2E',
        })
        .expect(400);

      expect(JSON.stringify(res.body.message)).toContain('email');
    });

    it('password demasiado corta → 400', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/registrar`)
        .send({
          email: `auth.e2e.corta.${sufijo}@busride.do`,
          password: 'corta',
          nombre: 'Ana',
          apellido: 'E2E',
        })
        .expect(400);
    });

    it('campo extra no permitido → 400 (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/registrar`)
        .send({
          email: `auth.e2e.extra.${sufijo}@busride.do`,
          password: PASSWORD_E2E,
          nombre: 'Ana',
          apellido: 'E2E',
          campoIntruso: 'no permitido',
        })
        .expect(400);
    });

    it('B1: enviar rolId al registro público → 400 (escalada de privilegios bloqueada)', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/registrar`)
        .send({
          email: `auth.e2e.admin.${sufijo}@busride.do`,
          password: PASSWORD_E2E,
          nombre: 'Intruso',
          apellido: 'E2E',
          rolId: ROL.ADMIN,
        })
        .expect(400);
    });
  });

  describe('POST /auth/usuarios (solo admin — B1)', () => {
    it('sin token → 401', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/usuarios`)
        .send({
          email: `auth.e2e.priv.${sufijo}@busride.do`,
          password: PASSWORD_E2E,
          nombre: 'Sin',
          apellido: 'Token',
          rolId: ROL.CONDUCTOR,
        })
        .expect(401);
    });

    it('con token de pasajero → 403 (RolesGuard)', async () => {
      const loginPasajero = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email, password: PASSWORD_E2E })
        .expect(200);

      await request(app.getHttpServer())
        .post(`${API}/auth/usuarios`)
        .set('Authorization', `Bearer ${loginPasajero.body.accessToken}`)
        .send({
          email: `auth.e2e.priv.${sufijo}@busride.do`,
          password: PASSWORD_E2E,
          nombre: 'Rol',
          apellido: 'Insuficiente',
          rolId: ROL.CONDUCTOR,
        })
        .expect(403);
    });

    it('con token de admin crea un usuario conductor → 201 y puede loguearse', async () => {
      const admin = await loguearAdminSeed(app);
      const emailConductor = `auth.e2e.conductor.${sufijo}@busride.do`;

      const res = await request(app.getHttpServer())
        .post(`${API}/auth/usuarios`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({
          email: emailConductor,
          password: PASSWORD_E2E,
          nombre: 'Carlos',
          apellido: 'E2E',
          rolId: ROL.CONDUCTOR,
        })
        .expect(201);

      expect(res.body.usuarioId).toBeDefined();

      const login = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: emailConductor, password: PASSWORD_E2E })
        .expect(200);
      expect(login.body.usuario.rol).toBe('conductor');
    });
  });

  describe('POST /auth/login', () => {
    it('credenciales correctas → 200 con accessToken + refreshToken', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email, password: PASSWORD_E2E })
        .expect(200);

      expect(typeof res.body.accessToken).toBe('string');
      expect(typeof res.body.refreshToken).toBe('string');
      expect(res.body.usuario).toMatchObject({ email, rol: 'pasajero' });
      expect(res.body.usuario.id.toLowerCase()).toBe(usuarioId.toLowerCase());

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('password incorrecta → 401', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email, password: 'PasswordIncorrecta1!' })
        .expect(401);
    });

    it('email inexistente → 401', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/login`)
        .send({ email: `no.existe.${sufijo}@busride.do`, password: PASSWORD_E2E })
        .expect(401);
    });
  });

  describe('POST /auth/refresh y /auth/logout', () => {
    it('refresh válido → 200 con par nuevo (rotación)', async () => {
      const res = await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken })
        .expect(200);

      expect(typeof res.body.accessToken).toBe('string');
      expect(typeof res.body.refreshToken).toBe('string');
      expect(res.body.refreshToken).not.toBe(refreshToken);

      accessTokenRotado = res.body.accessToken;
      refreshTokenRotado = res.body.refreshToken;
    });

    it('reuso del refresh token viejo (ya rotado) → 401', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken })
        .expect(401);
    });

    it('logout → 200 y el refresh vigente queda revocado (refresh → 401)', async () => {
      await request(app.getHttpServer())
        .post(`${API}/auth/logout`)
        .set('Authorization', `Bearer ${accessTokenRotado}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`${API}/auth/refresh`)
        .send({ refreshToken: refreshTokenRotado })
        .expect(401);
    });
  });

  describe('Endpoint protegido (JwtAuthGuard global)', () => {
    it('GET /usuarios/me sin token → 401', async () => {
      await request(app.getHttpServer()).get(`${API}/usuarios/me`).expect(401);
    });

    it('GET /usuarios/me con token válido → 200 con el perfil propio', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/usuarios/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(email);
    });
  });
});
