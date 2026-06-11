import { Injectable, computed, inject, signal } from '@angular/core';
import { Asociacion, AsociacionesApi } from '../../core/api';
import { AuthService, Rol } from '../../core/auth';
import { sonUuidsIguales } from '../../shared';
import { extraerMensajeError } from './mensaje-error.util';

/**
 * Contexto de asociación compartido por las páginas del panel (se provee en
 * la ruta raíz del área, ver panel.routes.ts).
 *
 * - admin: ve TODAS las asociaciones activas y elige una en el selector.
 * - asociacion: el backend no expone "GET /asociaciones/mia" (fricción
 *   reportada), así que se resuelve filtrando el listado de activas por
 *   `usuarioId === usuario autenticado`. Si su asociación aún no está
 *   ACTIVA (PENDIENTE/SUSPENDIDA) no aparecerá: las páginas muestran un
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

    this.asociacionesApi.listarActivas().subscribe({
      next: (lista) => {
        const usuarioId = this.auth.usuario()?.id;
        const visibles = this.esAdmin()
          ? lista
          : lista.filter((a) => sonUuidsIguales(a.usuarioId, usuarioId));
        this.asociacionesSignal.set(visibles);
        this.cargada = true;
        this.cargando.set(false);

        const seleccionActual = this.seleccionadaId();
        const sigueVigente =
          seleccionActual !== null && visibles.some((a) => sonUuidsIguales(a.id, seleccionActual));
        if (!sigueVigente) {
          this.seleccionadaId.set(visibles[0]?.id ?? null);
        }
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.error.set(extraerMensajeError(error, 'No se pudieron cargar las asociaciones'));
      },
    });
  }

  seleccionar(id: string): void {
    this.seleccionadaId.set(id);
  }
}
