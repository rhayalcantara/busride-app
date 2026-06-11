import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import {
  API,
  ROL,
  SesionE2E,
  crearAppE2E,
  crearUsuarioYLoguear,
  loguearAdminSeed,
  mismoUuid,
  registrarYLoguear,
} from './utils/e2e.helpers';

/**
 * Flujo de negocio completo (versión automatizada del smoke-test de la Ola 4):
 * registro → asociación → ruta/bus/conductor/asignación → compra de paquete
 * (con idempotencia) → viaje → reserva (QR) → abordaje → liquidación → calificación.
 *
 * Los pasos son secuenciales y comparten estado; datos únicos por corrida
 * (sufijo Date.now()) para no chocar con datos previos de la BD.
 */
describe('Flujo completo de negocio (e2e)', () => {
  let app: INestApplication;
  const sufijo = Date.now();
  const TARIFA = 50;
  const CAPACIDAD_BUS = 30;

  let admin: SesionE2E;
  let asociacionUser: SesionE2E;
  let conductorUser: SesionE2E;
  let pasajero: SesionE2E;

  let asociacionId: string;
  let rutaId: string;
  let paradas: Array<{ id: number; lat: number; lng: number; orden: number }>;
  let busId: string;
  let conductorId: string;
  let asignacionId: string;
  let viajeId: string;
  let reservaId: string;
  let qrToken: string;

  beforeAll(async () => {
    app = await crearAppE2E();
  });

  afterAll(async () => {
    // Obligatorio: ScheduleModule (cron de reservas) dejaría el proceso vivo
    await app.close();
  });

  it('1. obtiene los 4 usuarios (B1: admin del seed; asociación/conductor vía /auth/usuarios; pasajero público)', async () => {
    // El registro público ya no acepta roles privilegiados: el admin viene del
    // seed (04_seed_admin.sql) y crea los usuarios asociación/conductor.
    admin = await loguearAdminSeed(app);

    [asociacionUser, conductorUser, pasajero] = await Promise.all([
      crearUsuarioYLoguear(app, admin.accessToken, {
        email: `asociacion.e2e.${sufijo}@busride.do`,
        nombre: 'Asoc',
        apellido: 'E2E',
        rolId: ROL.ASOCIACION,
      }),
      crearUsuarioYLoguear(app, admin.accessToken, {
        email: `conductor.e2e.${sufijo}@busride.do`,
        nombre: 'Carlos',
        apellido: 'E2E',
        rolId: ROL.CONDUCTOR,
      }),
      registrarYLoguear(app, {
        email: `pasajero.e2e.${sufijo}@busride.do`,
        nombre: 'Pedro',
        apellido: 'E2E',
      }),
    ]);

    expect(admin.rol).toBe('admin');
    expect(asociacionUser.rol).toBe('asociacion');
    expect(conductorUser.rol).toBe('conductor');
    expect(pasajero.rol).toBe('pasajero');
  });

  it('2. admin crea la asociación (PENDIENTE) y la aprueba (ACTIVA)', async () => {
    const creada = await request(app.getHttpServer())
      .post(`${API}/asociaciones`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        usuarioId: asociacionUser.usuarioId,
        nombre: `Asociación E2E ${sufijo}`,
        rnc: `E2E-${sufijo}`,
        telefono: '809-555-0000',
      })
      .expect(201);

    expect(creada.body.estado).toBe('PENDIENTE');
    asociacionId = creada.body.id;

    const aprobada = await request(app.getHttpServer())
      .patch(`${API}/asociaciones/${asociacionId}/aprobar`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(aprobada.body.estado).toBe('ACTIVA');
    expect(mismoUuid(aprobada.body.aprobadoPor, admin.usuarioId)).toBe(true);
  });

  it('3a. la asociación crea una ruta con 3 paradas (asociación derivada del JWT)', async () => {
    const ruta = await request(app.getHttpServer())
      .post(`${API}/rutas`)
      .set('Authorization', `Bearer ${asociacionUser.accessToken}`)
      .send({
        nombre: `Ruta E2E ${sufijo}`,
        codigo: `RE2E-${String(sufijo).slice(-8)}`,
        descripcion: 'Ruta creada por el e2e del flujo completo',
        tarifa: TARIFA,
        paradas: [
          { nombre: 'Parada E2E 1', orden: 1, lat: 18.4861, lng: -69.9312, esTerminal: true },
          { nombre: 'Parada E2E 2', orden: 2, lat: 18.4750, lng: -69.9350 },
          { nombre: 'Parada E2E 3', orden: 3, lat: 18.4539, lng: -69.9395, esTerminal: true },
        ],
      })
      .expect(201);

    expect(ruta.body.id).toBeDefined();
    expect(mismoUuid(ruta.body.asociacionId, asociacionId)).toBe(true);
    rutaId = ruta.body.id;

    // Las paradas se leen de la columna geography (ubicacion.Lat/Long)
    const res = await request(app.getHttpServer())
      .get(`${API}/rutas/${rutaId}/paradas`)
      .set('Authorization', `Bearer ${asociacionUser.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(3);
    expect(res.body[0].orden).toBe(1);
    expect(res.body[0].lat).toBeCloseTo(18.4861, 4);
    expect(res.body[0].lng).toBeCloseTo(-69.9312, 4);
    paradas = res.body;
  });

  it('3b. la asociación crea bus, da de alta al conductor y crea la asignación', async () => {
    const bus = await request(app.getHttpServer())
      .post(`${API}/flota/buses`)
      .set('Authorization', `Bearer ${asociacionUser.accessToken}`)
      .send({
        asociacionId,
        placa: `E2E-${sufijo}`,
        marca: 'Mercedes-Benz',
        modelo: 'Sprinter 515',
        capacidadTotal: CAPACIDAD_BUS,
      })
      .expect(201);
    busId = bus.body.id;

    const conductor = await request(app.getHttpServer())
      .post(`${API}/conductores`)
      .set('Authorization', `Bearer ${asociacionUser.accessToken}`)
      .send({
        usuarioId: conductorUser.usuarioId,
        asociacionId,
        licenciaNumero: `LIC-E2E-${sufijo}`,
        licenciaVence: '2030-12-31',
      })
      .expect(201);
    expect(conductor.body.conductor?.id).toBeDefined();
    conductorId = conductor.body.conductor.id;

    const asignacion = await request(app.getHttpServer())
      .post(`${API}/flota/asignaciones`)
      .set('Authorization', `Bearer ${asociacionUser.accessToken}`)
      .send({ busId, rutaId, conductorId })
      .expect(201);
    expect(asignacion.body.id).toBeDefined();
    asignacionId = asignacion.body.id;
  });

  it('4. el pasajero compra un paquete y la recompra con la misma referencia es idempotente', async () => {
    const referenciaExterna = `PAY-E2E-${sufijo}`;

    const compra = await request(app.getHttpServer())
      .post(`${API}/wallet/comprar`)
      .set('Authorization', `Bearer ${pasajero.accessToken}`)
      .send({ paqueteId: 1, referenciaExterna })
      .expect(201);

    // Paquete Básico (seed): 10 viajes, sin bono; el pasajero es nuevo (saldo 0 → 10)
    expect(compra.body.idempotente).toBe(false);
    expect(compra.body.viajesAcreditados).toBe(10);
    expect(Number(compra.body.saldoViajes)).toBe(10);

    const repetida = await request(app.getHttpServer())
      .post(`${API}/wallet/comprar`)
      .set('Authorization', `Bearer ${pasajero.accessToken}`)
      .send({ paqueteId: 1, referenciaExterna })
      .expect(201);

    expect(repetida.body.idempotente).toBe(true);
    expect(mismoUuid(repetida.body.transaccionId, compra.body.transaccionId)).toBe(true);

    // El saldo NO se volvió a acreditar
    const saldo = await request(app.getHttpServer())
      .get(`${API}/wallet/mi-saldo`)
      .set('Authorization', `Bearer ${pasajero.accessToken}`)
      .expect(200);
    expect(Number(saldo.body.saldoViajes)).toBe(10);
  });

  it('5. el conductor inicia el viaje con la asignación', async () => {
    const viaje = await request(app.getHttpServer())
      .post(`${API}/viajes/iniciar`)
      .set('Authorization', `Bearer ${conductorUser.accessToken}`)
      .send({ asignacionId })
      .expect(201);

    expect(viaje.body.estado).toBe('EN_CURSO');
    expect(viaje.body.asientosDisponibles).toBe(CAPACIDAD_BUS);
    viajeId = viaje.body.id;

    const activo = await request(app.getHttpServer())
      .get(`${API}/viajes/mi-activo`)
      .set('Authorization', `Bearer ${conductorUser.accessToken}`)
      .expect(200);
    expect(mismoUuid(activo.body.id, viajeId)).toBe(true);
  });

  it('5b. B2: otro conductor NO puede iniciar viaje con una asignación ajena → 403', async () => {
    // Conductor intruso con perfil válido en la misma asociación
    const intruso = await crearUsuarioYLoguear(app, admin.accessToken, {
      email: `conductor2.e2e.${sufijo}@busride.do`,
      nombre: 'Intruso',
      apellido: 'E2E',
      rolId: ROL.CONDUCTOR,
    });

    await request(app.getHttpServer())
      .post(`${API}/conductores`)
      .set('Authorization', `Bearer ${asociacionUser.accessToken}`)
      .send({
        usuarioId: intruso.usuarioId,
        asociacionId,
        licenciaNumero: `LIC-INTRUSO-${sufijo}`,
        licenciaVence: '2030-12-31',
      })
      .expect(201);

    // La asignación pertenece al conductor original → IDOR bloqueado (B2)
    await request(app.getHttpServer())
      .post(`${API}/viajes/iniciar`)
      .set('Authorization', `Bearer ${intruso.accessToken}`)
      .send({ asignacionId })
      .expect(403);
  });

  it('6. el pasajero crea una reserva y recibe el qrToken', async () => {
    const reserva = await request(app.getHttpServer())
      .post(`${API}/reservas`)
      .set('Authorization', `Bearer ${pasajero.accessToken}`)
      .send({
        viajeId,
        paradaOrigenId: paradas[0].id,
        paradaDestinoId: paradas[2].id,
        latPasajero: paradas[0].lat,
        lngPasajero: paradas[0].lng,
      })
      .expect(201);

    expect(reserva.body.reservaId).toBeDefined();
    expect(typeof reserva.body.qrToken).toBe('string');
    expect(reserva.body.qrImagen).toMatch(/^data:image\/png;base64,/);
    reservaId = reserva.body.reservaId;
    qrToken = reserva.body.qrToken;

    const mias = await request(app.getHttpServer())
      .get(`${API}/reservas/mias`)
      .set('Authorization', `Bearer ${pasajero.accessToken}`)
      .expect(200);
    expect(mias.body.some((r: any) => mismoUuid(r.id, reservaId))).toBe(true);
  });

  it('7. el conductor confirma el abordaje: ticket, cobro y asientos decrementados', async () => {
    const abordaje = await request(app.getHttpServer())
      .post(`${API}/reservas/abordar`)
      .set('Authorization', `Bearer ${conductorUser.accessToken}`)
      .send({ qrToken, numeroAsiento: 5 })
      .expect(201);

    expect(abordaje.body.ticketCodigo).toMatch(/^TK-/);
    expect(abordaje.body.asiento).toBe(5);
    expect(Number(abordaje.body.monto)).toBe(TARIFA);
    expect(abordaje.body.asientosRestantes).toBe(CAPACIDAD_BUS - 1);

    // El SP descontó 1 viaje del saldo del pasajero (10 → 9)
    const saldo = await request(app.getHttpServer())
      .get(`${API}/wallet/mi-saldo`)
      .set('Authorization', `Bearer ${pasajero.accessToken}`)
      .expect(200);
    expect(Number(saldo.body.saldoViajes)).toBe(9);
  });

  it('8. el conductor finaliza el viaje, se liquida y aparece en /liquidaciones/mias', async () => {
    const liquidacion = await request(app.getHttpServer())
      .post(`${API}/viajes/${viajeId}/finalizar`)
      .set('Authorization', `Bearer ${conductorUser.accessToken}`)
      .expect(201);

    expect(liquidacion.body.total_pasajeros).toBe(1);
    expect(Number(liquidacion.body.ingreso_bruto)).toBe(TARIFA);
    const comisionPlat = Number(liquidacion.body.comision_plataforma);
    const comisionAsoc = Number(liquidacion.body.comision_asociacion);
    const netoConductor = Number(liquidacion.body.monto_neto_conductor);
    expect(comisionPlat + comisionAsoc + netoConductor).toBeCloseTo(TARIFA, 2);
    expect(netoConductor).toBeLessThan(TARIFA);

    const mias = await request(app.getHttpServer())
      .get(`${API}/liquidaciones/mias`)
      .set('Authorization', `Bearer ${conductorUser.accessToken}`)
      .expect(200);

    const laNueva = mias.body.find((l: any) => mismoUuid(l.viaje_id, viajeId));
    expect(laNueva).toBeDefined();
    expect(laNueva.estado).toBe('PENDIENTE');
    expect(Number(laNueva.monto_neto)).toBeCloseTo(netoConductor, 2);
  });

  it('9. el pasajero califica al conductor del viaje', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/conductores/${conductorId}/calificar`)
      .set('Authorization', `Bearer ${pasajero.accessToken}`)
      .send({ viajeId, estrellas: 5, comentario: 'Excelente servicio (e2e)' })
      .expect(201);

    expect(res.body).toBeDefined();
  });
});
