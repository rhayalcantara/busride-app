import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { AsociacionContextoService } from './asociacion-contexto.service';

/**
 * Selector de asociación de trabajo del panel.
 * - admin: mat-select con todas las asociaciones activas.
 * - asociacion: texto fijo con SU asociación (resuelta por el contexto) o un
 *   aviso si no tiene ninguna activa vinculada.
 */
@Component({
  selector: 'app-selector-asociacion',
  imports: [MatFormFieldModule, MatSelectModule],
  template: `
    @if (contexto.esAdmin()) {
      <mat-form-field appearance="outline" class="selector-asociacion__campo">
        <mat-label>Asociación</mat-label>
        <mat-select
          [value]="contexto.seleccionadaId()"
          (selectionChange)="contexto.seleccionar($event.value)"
        >
          @for (asociacion of contexto.asociaciones(); track asociacion.id) {
            <mat-option [value]="asociacion.id">{{ asociacion.nombre }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      @if (!contexto.cargando() && contexto.asociaciones().length === 0) {
        <p class="selector-asociacion__aviso">
          No hay asociaciones activas. Crea y aprueba una en la página «Asociaciones».
        </p>
      }
    } @else {
      @if (contexto.seleccionada(); as asociacion) {
        <p class="selector-asociacion__fija">
          Asociación: <strong>{{ asociacion.nombre }}</strong>
        </p>
      } @else if (!contexto.cargando()) {
        <p class="selector-asociacion__aviso">
          Tu usuario no está vinculado a ninguna asociación activa. Contacta al administrador.
        </p>
      }
    }
    @if (contexto.error(); as mensaje) {
      <p class="selector-asociacion__aviso" role="alert">{{ mensaje }}</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .selector-asociacion__campo {
        width: 100%;
        max-width: 360px;
      }
      .selector-asociacion__fija {
        margin: 0 0 12px;
        font-size: 15px;
      }
      .selector-asociacion__aviso {
        margin: 0 0 12px;
        color: var(--mat-sys-error, #b3261e);
        font-size: 14px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorAsociacionComponent {
  protected readonly contexto = inject(AsociacionContextoService);

  constructor() {
    this.contexto.cargar();
  }
}
