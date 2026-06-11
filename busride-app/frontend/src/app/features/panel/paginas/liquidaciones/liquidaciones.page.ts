import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LiquidacionPagadaRespuesta, LiquidacionesApi } from '../../../../core/api';
import { EstadoVacioComponent } from '../../../../shared';
import { extraerMensajeError } from '../../mensaje-error.util';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Liquidaciones (solo admin).
 *
 * LIMITACIÓN CONOCIDA del backend (notas Ola F2): NO existe un listado admin
 * de liquidaciones — solo `GET /liquidaciones/mias` y `/mias/resumen` (del
 * conductor autenticado) y `PATCH /liquidaciones/:id/pagar` (admin). Por eso
 * esta página no puede mostrar las pendientes: explica la limitación y ofrece
 * el flujo "marcar pagada por ID" con referencia de pago. F-09 debería añadir
 * `GET /liquidaciones` (admin) al backend.
 */
@Component({
  selector: 'app-liquidaciones-page',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    EstadoVacioComponent,
  ],
  template: `
    <header class="pagina-encabezado">
      <h2>Liquidaciones</h2>
    </header>

    <app-estado-vacio
      icono="receipt_long"
      mensaje="El backend aún no expone un listado de liquidaciones para administradores (solo el historial propio de cada conductor). Hasta que exista GET /liquidaciones (previsto para la tarea F-09), no es posible mostrar aquí las pendientes: obtén el ID de la liquidación desde la base de datos o desde el conductor y márcala como pagada abajo."
    />

    <mat-card appearance="outlined" class="card-pagar">
      <mat-card-header>
        <mat-card-title>Marcar liquidación como pagada</mat-card-title>
        <mat-card-subtitle>
          PATCH /liquidaciones/:id/pagar — requiere el ID y una referencia de pago
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="formulario" (ngSubmit)="marcarPagada()" novalidate>
          <mat-form-field appearance="outline" class="campo-completo">
            <mat-label>ID de la liquidación (UUID)</mat-label>
            <input
              matInput
              formControlName="liquidacionId"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
            @if (formulario.controls.liquidacionId.hasError('required')) {
              <mat-error>El ID es obligatorio</mat-error>
            } @else if (formulario.controls.liquidacionId.hasError('pattern')) {
              <mat-error>Debe ser un UUID válido</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="campo-completo">
            <mat-label>Referencia de pago</mat-label>
            <input
              matInput
              formControlName="referenciaPago"
              maxlength="100"
              placeholder="TRANSF-2026-0001"
            />
            @if (formulario.controls.referenciaPago.hasError('required')) {
              <mat-error>La referencia es obligatoria</mat-error>
            }
          </mat-form-field>

          @if (errorBackend(); as mensaje) {
            <p class="mensaje mensaje--error" role="alert">{{ mensaje }}</p>
          }
          @if (resultado(); as exito) {
            <p class="mensaje mensaje--ok" role="status">
              <mat-icon class="mensaje__icono">check_circle</mat-icon>
              {{ exito.mensaje }} (liquidación {{ exito.liquidacionId }}, estado
              {{ exito.estado }}, referencia {{ exito.referenciaPago }})
            </p>
          }

          <button mat-flat-button type="submit" [disabled]="cargando()">
            @if (cargando()) {
              <mat-spinner diameter="20" />
            } @else {
              Marcar pagada
            }
          </button>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .pagina-encabezado {
        margin-bottom: 12px;
      }
      .pagina-encabezado h2 {
        margin: 0;
      }
      .card-pagar {
        max-width: 560px;
        margin: 16px auto 0;
      }
      .card-pagar form {
        display: flex;
        flex-direction: column;
        margin-top: 12px;
      }
      .campo-completo {
        width: 100%;
      }
      .mensaje {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        margin: 0 0 12px;
      }
      .mensaje--error {
        color: var(--mat-sys-error, #b3261e);
      }
      .mensaje--ok {
        color: #1e7d32;
      }
      .mensaje__icono {
        flex-shrink: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiquidacionesPageComponent {
  private readonly liquidacionesApi = inject(LiquidacionesApi);

  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);
  protected readonly resultado = signal<LiquidacionPagadaRespuesta | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    liquidacionId: ['', [Validators.required, Validators.pattern(UUID_REGEX)]],
    referenciaPago: ['', Validators.required],
  });

  marcarPagada(): void {
    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.errorBackend.set(null);
    this.resultado.set(null);

    const { liquidacionId, referenciaPago } = this.formulario.getRawValue();
    this.liquidacionesApi.marcarPagada(liquidacionId.trim(), referenciaPago.trim()).subscribe({
      next: (respuesta) => {
        this.cargando.set(false);
        this.resultado.set(respuesta);
        this.formulario.reset();
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorBackend.set(
          extraerMensajeError(error, 'No se pudo marcar la liquidación como pagada'),
        );
      },
    });
  }
}
