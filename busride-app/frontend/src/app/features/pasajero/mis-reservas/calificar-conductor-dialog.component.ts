import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CalificacionRegistrada, ConductoresApi } from '../../../core/api';
import { extraerMensajeError } from '../../../shared';

/** Contexto del abordaje a calificar. */
export interface DatosCalificarDialog {
  conductorId: string;
  viajeId: string;
  nombreRuta?: string;
}

const ESTRELLAS = [1, 2, 3, 4, 5] as const;

/**
 * Diálogo de calificación del conductor: estrellas 1-5 + comentario opcional
 * → POST /conductores/:id/calificar. Cierra con la respuesta del backend si
 * la calificación se registró; los errores (400/409) se muestran dentro del
 * diálogo con el mensaje del backend.
 */
@Component({
  selector: 'app-calificar-conductor-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Calificar al conductor</h2>
    <mat-dialog-content class="calificar">
      @if (datos.nombreRuta) {
        <p class="calificar__ruta">{{ datos.nombreRuta }}</p>
      }

      <div class="calificar__estrellas" role="radiogroup" aria-label="Calificación en estrellas">
        @for (valor of valores; track valor) {
          <button
            mat-icon-button
            type="button"
            role="radio"
            [attr.aria-checked]="estrellas() === valor"
            [attr.aria-label]="valor + ' estrella(s)'"
            (click)="estrellas.set(valor)"
          >
            <mat-icon [class.calificar__estrella--activa]="valor <= estrellas()">
              {{ valor <= estrellas() ? 'star' : 'star_border' }}
            </mat-icon>
          </button>
        }
      </div>

      <mat-form-field appearance="outline" class="calificar__comentario">
        <mat-label>Comentario (opcional)</mat-label>
        <textarea
          matInput
          rows="3"
          maxlength="500"
          [(ngModel)]="comentario"
          [disabled]="enviando()"
        ></textarea>
      </mat-form-field>

      @if (error(); as mensaje) {
        <p class="calificar__error">{{ mensaje }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="null" [disabled]="enviando()">
        Cancelar
      </button>
      <button
        mat-flat-button
        type="button"
        (click)="enviar()"
        [disabled]="estrellas() === 0 || enviando()"
      >
        @if (enviando()) {
          <mat-progress-spinner diameter="20" mode="indeterminate" />
        } @else {
          Enviar calificación
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .calificar {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: min(320px, 80vw);
      }
      .calificar__ruta {
        margin: 0;
        font-weight: 500;
      }
      .calificar__estrellas {
        display: flex;
        justify-content: center;
      }
      .calificar__estrella--activa {
        color: #f9a825;
      }
      .calificar__comentario {
        width: 100%;
      }
      .calificar__error {
        margin: 0;
        color: var(--mat-sys-error, #b00020);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalificarConductorDialogComponent {
  protected readonly datos = inject<DatosCalificarDialog>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<CalificarConductorDialogComponent, CalificacionRegistrada | null>>(
      MatDialogRef,
    );
  private readonly conductoresApi = inject(ConductoresApi);

  protected readonly valores = ESTRELLAS;
  protected readonly estrellas = signal(0);
  protected comentario = '';
  protected readonly enviando = signal(false);
  protected readonly error = signal('');

  enviar(): void {
    if (this.estrellas() === 0 || this.enviando()) return;
    this.enviando.set(true);
    this.error.set('');

    const comentario = this.comentario.trim();
    this.conductoresApi
      .calificar(this.datos.conductorId, {
        viajeId: this.datos.viajeId,
        estrellas: this.estrellas(),
        ...(comentario !== '' ? { comentario } : {}),
      })
      .subscribe({
        next: (respuesta) => this.dialogRef.close(respuesta),
        error: (err: unknown) => {
          this.enviando.set(false);
          this.error.set(extraerMensajeError(err, 'No se pudo registrar la calificación'));
        },
      });
  }
}
