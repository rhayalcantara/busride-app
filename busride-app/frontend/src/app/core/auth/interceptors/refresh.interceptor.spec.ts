import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../auth.service';
import { TokenStorage } from '../token-storage.service';
import { Rol } from '../models/sesion.model';
import { authInterceptor } from './auth.interceptor';
import { refreshInterceptor } from './refresh.interceptor';

// JWT sin firmar, decodificable con atob por AuthService
function crearJwt(payload: Record<string, unknown>): string {
  const codificar = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${codificar({ alg: 'HS256', typ: 'JWT' })}.${codificar(payload)}.firma`;
}

describe('refreshInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tokenStorage: TokenStorage;
  let router: Router;

  const NO_AUTORIZADO = { status: 401, statusText: 'Unauthorized' };
  const AHORA_SEG = Math.floor(Date.now() / 1000);
  const ACCESS_NUEVO = crearJwt({
    sub: 'u1',
    email: 'ana@correo.com',
    rol: Rol.PASAJERO,
    iat: AHORA_SEG,
    exp: AHORA_SEG + 900,
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // Mismo orden que registrará F-05: auth primero, refresh después
        provideHttpClient(withInterceptors([authInterceptor, refreshInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    tokenStorage = TestBed.inject(TokenStorage);
    router = TestBed.inject(Router);
    tokenStorage.guardarTokens({ accessToken: 'acceso-viejo', refreshToken: 'refresco-viejo' });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('ante un 401 refresca y reintenta la request con el token nuevo', () => {
    let resultado: unknown;
    http.get('/api/v1/reservas/mias').subscribe((r) => (resultado = r));

    httpMock.expectOne('/api/v1/reservas/mias').flush({ message: 'expirado' }, NO_AUTORIZADO);

    httpMock
      .expectOne('/api/v1/auth/refresh')
      .flush({ accessToken: ACCESS_NUEVO, refreshToken: 'refresco-nuevo' });

    const reintento = httpMock.expectOne('/api/v1/reservas/mias');
    expect(reintento.request.headers.get('Authorization')).toBe(`Bearer ${ACCESS_NUEVO}`);
    reintento.flush([{ id: 'r1' }]);

    expect(resultado).toEqual([{ id: 'r1' }]);
    expect(tokenStorage.obtenerRefreshToken()).toBe('refresco-nuevo');
  });

  it('encola los 401 concurrentes: UN solo refresh y todas las requests se reintentan', () => {
    const resultados: unknown[] = [];
    http.get('/api/v1/rutas').subscribe((r) => resultados.push(r));
    http.get('/api/v1/viajes/mi-activo').subscribe((r) => resultados.push(r));

    // Ambas fallan con 401 ANTES de que el refresh resuelva
    httpMock.expectOne('/api/v1/rutas').flush({ message: 'expirado' }, NO_AUTORIZADO);
    httpMock.expectOne('/api/v1/viajes/mi-activo').flush({ message: 'expirado' }, NO_AUTORIZADO);

    // expectOne garantiza que solo hubo UNA llamada a /auth/refresh
    httpMock
      .expectOne('/api/v1/auth/refresh')
      .flush({ accessToken: ACCESS_NUEVO, refreshToken: 'refresco-nuevo' });

    // Las dos requests en cola se reintentan con el MISMO token nuevo
    const reintento1 = httpMock.expectOne('/api/v1/rutas');
    const reintento2 = httpMock.expectOne('/api/v1/viajes/mi-activo');
    expect(reintento1.request.headers.get('Authorization')).toBe(`Bearer ${ACCESS_NUEVO}`);
    expect(reintento2.request.headers.get('Authorization')).toBe(`Bearer ${ACCESS_NUEVO}`);
    reintento1.flush({ ok: 1 });
    reintento2.flush({ ok: 2 });

    expect(resultados).toEqual([{ ok: 1 }, { ok: 2 }]);
  });

  it('si el refresh falla: limpia la sesión y redirige a /login', () => {
    const auth = TestBed.inject(AuthService);
    const navegar = spyOn(router, 'navigate').and.resolveTo(true);

    let fallo = false;
    http.get('/api/v1/rutas').subscribe({ error: () => (fallo = true) });

    httpMock.expectOne('/api/v1/rutas').flush({ message: 'expirado' }, NO_AUTORIZADO);
    httpMock
      .expectOne('/api/v1/auth/refresh')
      .flush({ message: 'refresh inválido' }, NO_AUTORIZADO);

    expect(fallo).toBeTrue();
    expect(auth.estaAutenticado()).toBeFalse();
    expect(tokenStorage.obtenerAccessToken()).toBeNull();
    expect(tokenStorage.obtenerRefreshToken()).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/login']);
  });

  it('no intenta refrescar ante 401 de los endpoints públicos de auth', () => {
    let fallo = false;
    http
      .post('/api/v1/auth/login', { email: 'x@y.com', password: 'mala' })
      .subscribe({ error: () => (fallo = true) });

    httpMock
      .expectOne('/api/v1/auth/login')
      .flush({ message: 'Credenciales inválidas' }, NO_AUTORIZADO);

    httpMock.expectNone('/api/v1/auth/refresh');
    expect(fallo).toBeTrue();
  });

  it('propaga errores que no son 401 sin refrescar', () => {
    let estado = 0;
    http.get('/api/v1/rutas').subscribe({
      error: (e: { status: number }) => (estado = e.status),
    });

    httpMock
      .expectOne('/api/v1/rutas')
      .flush({ message: 'error interno' }, { status: 500, statusText: 'Server Error' });

    httpMock.expectNone('/api/v1/auth/refresh');
    expect(estado).toBe(500);
  });
});
