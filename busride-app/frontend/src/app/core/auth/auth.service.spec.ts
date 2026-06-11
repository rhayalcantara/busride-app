import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { TokenStorage } from './token-storage.service';
import { Rol, RespuestaLogin } from './models/sesion.model';

// Construye un JWT sin firmar válido para decodificarse con atob
function crearJwt(payload: Record<string, unknown>): string {
  const codificar = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${codificar({ alg: 'HS256', typ: 'JWT' })}.${codificar(payload)}.firma`;
}

const AHORA_SEG = Math.floor(Date.now() / 1000);

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tokenStorage: TokenStorage;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    tokenStorage = TestBed.inject(TokenStorage);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('login', () => {
    it('guarda los tokens y publica el usuario en los signals', () => {
      const respuesta: RespuestaLogin = {
        accessToken: 'acceso-1',
        refreshToken: 'refresco-1',
        usuario: {
          id: 'u1',
          nombre: 'Ana',
          apellido: 'García',
          email: 'ana@correo.com',
          rol: Rol.PASAJERO,
        },
      };

      service.login({ email: 'ana@correo.com', password: 'Secreta123!' }).subscribe();

      const req = httpMock.expectOne('/api/v1/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'ana@correo.com', password: 'Secreta123!' });
      req.flush(respuesta);

      expect(tokenStorage.obtenerAccessToken()).toBe('acceso-1');
      expect(tokenStorage.obtenerRefreshToken()).toBe('refresco-1');
      expect(service.estaAutenticado()).toBeTrue();
      expect(service.usuario()?.nombre).toBe('Ana');
      expect(service.rol()).toBe(Rol.PASAJERO);
    });

    it('no altera el estado si las credenciales son inválidas', () => {
      let errorRecibido = false;
      service.login({ email: 'x@y.com', password: 'mala' }).subscribe({
        error: () => (errorRecibido = true),
      });

      httpMock
        .expectOne('/api/v1/auth/login')
        .flush({ message: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });

      expect(errorRecibido).toBeTrue();
      expect(service.estaAutenticado()).toBeFalse();
      expect(tokenStorage.obtenerAccessToken()).toBeNull();
    });
  });

  describe('registrar', () => {
    it('envía SOLO los campos del RegistrarDto (sin rolId ni extras)', () => {
      service
        .registrar({
          email: 'nuevo@correo.com',
          password: 'Secreta123!',
          nombre: 'Juan',
          apellido: 'Pérez',
        })
        .subscribe();

      const req = httpMock.expectOne('/api/v1/auth/registrar');
      expect(req.request.method).toBe('POST');
      expect(Object.keys(req.request.body as object).sort()).toEqual([
        'apellido',
        'email',
        'nombre',
        'password',
      ]);
      req.flush({ mensaje: 'Usuario registrado.', usuarioId: 'u2' });

      // Registrar no inicia sesión
      expect(service.estaAutenticado()).toBeFalse();
    });
  });

  describe('refrescar', () => {
    it('rota el par de tokens: persiste los DOS nuevos', () => {
      tokenStorage.guardarTokens({ accessToken: 'viejo', refreshToken: 'refresco-viejo' });
      const nuevoAccess = crearJwt({
        sub: 'u1',
        email: 'ana@correo.com',
        rol: Rol.PASAJERO,
        iat: AHORA_SEG,
        exp: AHORA_SEG + 900,
      });

      let recibido: string | undefined;
      service.refrescar().subscribe((token) => (recibido = token));

      const req = httpMock.expectOne('/api/v1/auth/refresh');
      expect(req.request.body).toEqual({ refreshToken: 'refresco-viejo' });
      req.flush({ accessToken: nuevoAccess, refreshToken: 'refresco-nuevo' });

      expect(recibido).toBe(nuevoAccess);
      expect(tokenStorage.obtenerAccessToken()).toBe(nuevoAccess);
      expect(tokenStorage.obtenerRefreshToken()).toBe('refresco-nuevo');
      expect(service.usuario()?.email).toBe('ana@correo.com');
    });

    it('comparte UNA sola llamada entre suscriptores concurrentes', () => {
      tokenStorage.guardarTokens({ accessToken: 'viejo', refreshToken: 'refresco-viejo' });
      const nuevoAccess = crearJwt({
        sub: 'u1',
        email: 'ana@correo.com',
        rol: Rol.PASAJERO,
        iat: AHORA_SEG,
        exp: AHORA_SEG + 900,
      });

      const recibidos: string[] = [];
      service.refrescar().subscribe((t) => recibidos.push(t));
      service.refrescar().subscribe((t) => recibidos.push(t));

      // expectOne falla si hubiera más de una request a /auth/refresh
      httpMock
        .expectOne('/api/v1/auth/refresh')
        .flush({ accessToken: nuevoAccess, refreshToken: 'refresco-nuevo' });

      expect(recibidos).toEqual([nuevoAccess, nuevoAccess]);
    });

    it('falla sin llamar al backend cuando no hay refresh token', () => {
      let fallo = false;
      service.refrescar().subscribe({ error: () => (fallo = true) });

      httpMock.expectNone('/api/v1/auth/refresh');
      expect(fallo).toBeTrue();
    });
  });

  describe('logout', () => {
    it('limpia almacenamiento y estado aunque la llamada al backend falle', () => {
      tokenStorage.guardarTokens({ accessToken: 'acceso-1', refreshToken: 'refresco-1' });

      service.logout();

      // La limpieza es síncrona, antes incluso de la respuesta HTTP
      expect(service.estaAutenticado()).toBeFalse();
      expect(tokenStorage.obtenerAccessToken()).toBeNull();
      expect(tokenStorage.obtenerRefreshToken()).toBeNull();

      httpMock
        .expectOne('/api/v1/auth/logout')
        .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });

      expect(service.estaAutenticado()).toBeFalse();
    });
  });

  describe('cargarSesion', () => {
    it('restaura el usuario decodificando un access token vigente', async () => {
      const token = crearJwt({
        sub: 'u1',
        email: 'ana@correo.com',
        rol: Rol.CONDUCTOR,
        iat: AHORA_SEG,
        exp: AHORA_SEG + 900,
      });
      tokenStorage.guardarTokens({ accessToken: token, refreshToken: 'refresco-1' });

      await service.cargarSesion();

      expect(service.estaAutenticado()).toBeTrue();
      expect(service.usuario()?.id).toBe('u1');
      expect(service.rol()).toBe(Rol.CONDUCTOR);
      httpMock.expectNone('/api/v1/auth/refresh');
    });

    it('intenta refrescar cuando el access token está expirado', async () => {
      const expirado = crearJwt({
        sub: 'u1',
        email: 'ana@correo.com',
        rol: Rol.PASAJERO,
        iat: AHORA_SEG - 1000,
        exp: AHORA_SEG - 100,
      });
      const nuevo = crearJwt({
        sub: 'u1',
        email: 'ana@correo.com',
        rol: Rol.PASAJERO,
        iat: AHORA_SEG,
        exp: AHORA_SEG + 900,
      });
      tokenStorage.guardarTokens({ accessToken: expirado, refreshToken: 'refresco-1' });

      const promesa = service.cargarSesion();
      httpMock
        .expectOne('/api/v1/auth/refresh')
        .flush({ accessToken: nuevo, refreshToken: 'refresco-2' });
      await promesa;

      expect(service.estaAutenticado()).toBeTrue();
      expect(tokenStorage.obtenerRefreshToken()).toBe('refresco-2');
    });

    it('limpia la sesión si el token está expirado y el refresh falla', async () => {
      const expirado = crearJwt({
        sub: 'u1',
        email: 'ana@correo.com',
        rol: Rol.PASAJERO,
        iat: AHORA_SEG - 1000,
        exp: AHORA_SEG - 100,
      });
      tokenStorage.guardarTokens({ accessToken: expirado, refreshToken: 'refresco-1' });

      const promesa = service.cargarSesion();
      httpMock
        .expectOne('/api/v1/auth/refresh')
        .flush({ message: 'inválido' }, { status: 401, statusText: 'Unauthorized' });
      await promesa;

      expect(service.estaAutenticado()).toBeFalse();
      expect(tokenStorage.obtenerAccessToken()).toBeNull();
    });

    it('no hace nada (estado limpio) cuando no hay tokens almacenados', async () => {
      await service.cargarSesion();

      expect(service.estaAutenticado()).toBeFalse();
      httpMock.expectNone('/api/v1/auth/refresh');
    });
  });
});
