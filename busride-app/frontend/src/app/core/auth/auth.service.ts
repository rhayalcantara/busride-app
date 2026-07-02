import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenStorage } from './token-storage.service';
import {
  Credenciales,
  DatosRegistro,
  ParTokens,
  PayloadJwt,
  RespuestaLogin,
  RespuestaRegistro,
  Rol,
  UsuarioSesion,
} from './models/sesion.model';

/**
 * Estado de autenticación de la app (signals) + llamadas a /auth del backend.
 *
 * - El refresh token es OPACO y el backend lo ROTA en cada /auth/refresh:
 *   siempre se persisten los DOS tokens nuevos.
 * - `refrescar()` comparte UNA sola llamada en vuelo: las suscripciones
 *   concurrentes (p. ej. varios 401 simultáneos en refreshInterceptor)
 *   esperan el mismo resultado y reciben el mismo accessToken nuevo.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorage);

  private readonly usuarioSignal = signal<UsuarioSesion | null>(null);

  /** Usuario autenticado actual (null si no hay sesión). */
  readonly usuario = this.usuarioSignal.asReadonly();
  /** true cuando hay una sesión activa en memoria. */
  readonly estaAutenticado = computed(() => this.usuarioSignal() !== null);
  /** Rol del usuario autenticado (null si no hay sesión). */
  readonly rol = computed<Rol | null>(() => this.usuarioSignal()?.rol ?? null);

  /** Refresh en vuelo compartido (cola implícita de requests que esperan el token nuevo). */
  private refrescoEnCurso$: Observable<string> | null = null;

  /** POST /auth/login — guarda tokens y publica el usuario en los signals. */
  login(credenciales: Credenciales): Observable<RespuestaLogin> {
    return this.http
      .post<RespuestaLogin>(`${environment.apiUrl}/auth/login`, credenciales)
      .pipe(
        tap((respuesta) => {
          this.tokenStorage.guardarTokens(respuesta);
          this.usuarioSignal.set(respuesta.usuario);
        }),
      );
  }

  /**
   * POST /auth/registrar — SOLO crea pasajeros. El cuerpo espeja el
   * RegistrarDto del backend sin campos extra (forbidNonWhitelisted).
   * No inicia sesión: el llamador debe hacer login después.
   */
  registrar(datos: DatosRegistro): Observable<RespuestaRegistro> {
    const cuerpo: DatosRegistro = {
      email: datos.email,
      password: datos.password,
      nombre: datos.nombre,
      apellido: datos.apellido,
    };
    return this.http.post<RespuestaRegistro>(`${environment.apiUrl}/auth/registrar`, cuerpo);
  }

  /**
   * POST /auth/refresh — rota el refresh token y emite el accessToken nuevo.
   * Si ya hay un refresh en vuelo, devuelve ese mismo observable compartido:
   * así nunca se dispara más de UNA llamada concurrente.
   */
  refrescar(): Observable<string> {
    if (this.refrescoEnCurso$) {
      return this.refrescoEnCurso$;
    }

    const refreshToken = this.tokenStorage.obtenerRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No hay refresh token almacenado'));
    }

    this.refrescoEnCurso$ = this.http
      .post<ParTokens>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((tokens) => {
          // El backend ROTA el refresh token: persistir SIEMPRE los dos nuevos
          this.tokenStorage.guardarTokens(tokens);
          this.actualizarUsuarioDesdeToken(tokens.accessToken);
        }),
        map((tokens) => tokens.accessToken),
        finalize(() => {
          this.refrescoEnCurso$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    return this.refrescoEnCurso$;
  }

  /**
   * POST /auth/logout (revoca los refresh tokens en el backend) y limpia
   * almacenamiento + estado PASE LO QUE PASE con la llamada HTTP.
   * La limpieza es síncrona: tras invocar este método ya no hay sesión local.
   */
  logout(): void {
    // La suscripción es síncrona hasta el envío: el authInterceptor todavía
    // encuentra el accessToken en el storage para el header Authorization.
    this.http
      .post(`${environment.apiUrl}/auth/logout`, {})
      .pipe(catchError(() => of(null)))
      .subscribe();
    this.limpiarSesion();
  }

  /** Limpia tokens y estado en memoria SIN llamar al backend (refresh fallido, etc.). */
  limpiarSesion(): void {
    this.tokenStorage.limpiar();
    this.usuarioSignal.set(null);
  }

  /**
   * Restaura la sesión al arrancar la app: decodifica el payload del access
   * token almacenado (atob, sin librerías) para leer expiración y datos del
   * usuario. Si está expirado intenta refrescar; si no se puede, limpia.
   */
  async cargarSesion(): Promise<void> {
    const accessToken = this.tokenStorage.obtenerAccessToken();
    if (!accessToken) {
      this.limpiarSesion();
      return;
    }

    const payload = this.decodificarPayload(accessToken);
    const ahoraSegundos = Date.now() / 1000;

    if (payload && payload.exp > ahoraSegundos) {
      this.usuarioSignal.set(this.usuarioDesdePayload(payload));
      return;
    }

    // Token expirado o ilegible: intentar rotar con el refresh token
    if (this.tokenStorage.obtenerRefreshToken()) {
      try {
        await firstValueFrom(this.refrescar());
      } catch {
        this.limpiarSesion();
      }
    } else {
      this.limpiarSesion();
    }
  }

  /** Decodifica el payload de un JWT con atob (base64url → JSON). Null si es ilegible. */
  private decodificarPayload(token: string): PayloadJwt | null {
    try {
      const partes = token.split('.');
      if (partes.length !== 3) return null;

      const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
      const relleno = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      // atob devuelve binario latin1: re-decodificar como UTF-8 por seguridad
      const json = decodeURIComponent(
        atob(relleno)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(json) as PayloadJwt;
    } catch {
      return null;
    }
  }

  private usuarioDesdePayload(payload: PayloadJwt): UsuarioSesion {
    // El JWT del backend solo trae { sub, email, rol }: nombre y apellido se
    // conservan si ya estaban en memoria (login previo) o quedan vacíos hasta
    // que una feature los rehidrate vía GET /usuarios/me.
    const actual = this.usuarioSignal();
    const mismoUsuario = actual !== null && actual.id === payload.sub;
    return {
      id: payload.sub,
      email: payload.email,
      rol: payload.rol,
      nombre: mismoUsuario ? actual.nombre : '',
      apellido: mismoUsuario ? actual.apellido : '',
    };
  }

  private actualizarUsuarioDesdeToken(accessToken: string): void {
    const payload = this.decodificarPayload(accessToken);
    if (payload) {
      this.usuarioSignal.set(this.usuarioDesdePayload(payload));
    }
  }
}
