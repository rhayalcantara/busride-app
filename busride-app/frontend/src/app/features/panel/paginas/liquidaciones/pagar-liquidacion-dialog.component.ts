import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  LiquidacionAdmin,
  LiquidacionPagadaRespuesta,
  LiquidacionesApi,
} from '../../../../core/api';
import { MonedaDopPipe, extraerMensajeError } from '../../../../shared';

export interface DatosPagarLiquidacionDialog {
  liquidacion: LiquidacionAdmin;
}

/**
 * Marca una liquidación PENDIENTE como pagada (PATCH /liquidaciones/:id/pagar):
 * pide la referencia del pago y devuelve la respuesta del backend al cerrar.
 */
@Component({
  selector: 'app-pagar-liquidacion-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MonedaDopPipe,
  ],
  template: `
    <h2 mat-dialog-title>Marcar liquidación como pagada</h2>
    <mat-dialog-content>
      <p class="resumen">
        {{ datos.liquidacion.conductor_nombre }} ·
        {{ datos.liquidacion.ruta_nombre || 'Sin ruta' }} ·
        neto <strong>{{ datos.liquidacion.monto_neto | monedaDop }}</strong>
      </p>
      <form [formGroup]="formulario" (ngSubmit)="confirmar()" novalidate>
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
          <p class="error-dialogo" role="alert">{{ mensaje }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [disabled]="cargando()" (click)="dialogRef.close()">
        Cancelar
      </button>
      <button mat-flat-button type="button" [disabled]="cargando()" (click)="confirmar()">
        @if (cargando()) {
          <mat-spinner diameter="20" />
        } @else {
          Marcar pagada
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .resumen {
        margin: 0 0 8px;
        font-size: 14px;
      }
      .campo-completo {
        width: 100%;
        min-width: min(360px, 75vw);
      }
      .error-dialogo {
        color: var(--mat-sys-error, #b3261e);
        font-size: 14px;
        margin: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagarLiquidacionDialogComponent {
  protected readonly dialogRef =
    inject<MatDialogRef<PagarLiquidacionDialogComponent, LiquidacionPagadaRespuesta>>(MatDialogRef);
  protected readonly datos = inject<DatosPagarLiquidacionDialog>(MAT_DIALOG_DATA);
  private readonly liquidacionesApi = inject(LiquidacionesApi);

  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    referenciaPago: ['', Validators.required],
  });

  confirmar(): void {
    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.errorBackend.set(null);

    const { referenciaPago } = this.formulario.getRawValue();
    this.liquidacionesApi.marcarPagada(this.datos.liquidacion.id, referenciaPago.trim()).subscribe({
      next: (respuesta) => this.dialogRef.close(respuesta),
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorBackend.set(
          extraerMensajeError(error, 'No se pudo marcar la liquidación como pagada'),
        );
      },
    });
  }
}
