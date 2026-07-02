import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Asociacion, AsociacionesApi } from '../../core/api';
import { AuthService, Rol } from '../../core/auth';
import { extraerMensajeError, sonUuidsIguales } from '../../shared';

/**
 * Contexto de asociación compartido por las páginas del panel (se provee en
 * la ruta raíz del área, ver panel.routes.ts).
 *
 * - admin: ve TODAS las asociaciones activas y elige una en el selector.
 * - asociacion: usa GET /asociaciones/mia (F-09a) — devuelve su asociación
 *   sin importar el estado; si el backend responde 404 (usuario sin
 *   asociación vinculada) la lista queda vacía y las páginas muestran un
 *   aviso claro.
 */
@Injectable()
export class AsociacionContextoService {
  private readonly auth = inject(AuthService);
  private readonly asociacionesApi = inject(AsociacionesApi);

  private readonly asociacionesSignal = signal<Asociacion[]>([]);
  private cargada = false;

  /** Asociaciones visibles para el usuario actual (admin: todas las activas). */
  readonly asociaciones = this.asociacionesSignal.asReadonly();
  readonly seleccionadaId = signal<string | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  readonly esAdmin = computed(() => this.auth.rol() === Rol.ADMIN);

  readonly seleccionada = computed<Asociacion | null>(() => {
    const id = this.seleccionadaId();
    return this.asociaciones().find((a) => sonUuidsIguales(a.id, id)) ?? null;
  });

  /** Carga (una vez) las asociaciones visibles y auto-selecciona la primera. */
  cargar(forzar = false): void {
    if ((this.cargada && !forzar) || this.cargando()) {
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    if (this.esAdmin()) {
      this.asociacionesApi.listar().subscribe({
        next: (lista) => this.aplicar(lista),
        error: (error: unknown) => this.fallar(error),
      });
      return;
    }

    // Rol asociacion: el backend resuelve cuál es la suya (F-09a).
    this.asociacionesApi.obtenerMia().subscribe({
      next: (mia) => this.aplicar([mia]),
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          // Usuario sin asociación vinculada: lista vacía, las páginas avisan.
          this.aplicar([]);
          return;
        }
        this.fallar(error);
      },
    });
  }

  private aplicar(visibles: Asociacion[]): void {
    this.asociacionesSignal.set(visibles);
    this.cargada = true;
    this.cargando.set(false);

    const seleccionActual = this.seleccionadaId();
    const sigueVigente =
      seleccionActual !== null && visibles.some((a) => sonUuidsIguales(a.id, seleccionActual));
    if (!sigueVigente) {
      this.seleccionadaId.set(visibles[0]?.id ?? null);
    }
  }

  private fallar(error: unknown): void {
    this.cargando.set(false);
    this.error.set(extraerMensajeError(error, 'No se pudieron cargar las asociaciones'));
  }

  seleccionar(id: string): void {
    this.seleccionadaId.set(id);
  }
}
