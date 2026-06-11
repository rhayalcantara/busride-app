import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Observable, map } from 'rxjs';

/** Datos del diálogo de confirmación. */
export interface DatosConfirmDialog {
  mensaje: string;
  titulo?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
}

/**
 * Diálogo de confirmación genérico. Devuelve `true` solo si el usuario
 * confirma (cerrar con Escape/clic fuera cuenta como cancelar).
 *
 * Uso directo con el helper estático:
 * ```ts
 * ConfirmDialogComponent.abrir(this.dialog, { mensaje: '¿Eliminar la ruta?' })
 *   .subscribe((confirmado) => { ... });
 * ```
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ datos.titulo ?? 'Confirmar' }}</h2>
    <mat-dialog-content>
      <p>{{ datos.mensaje }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">
        {{ datos.textoCancelar ?? 'Cancelar' }}
      </button>
      <button mat-flat-button type="button" cdkFocusInitial [mat-dialog-close]="true">
        {{ datos.textoConfirmar ?? 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  readonly datos = inject<DatosConfirmDialog>(MAT_DIALOG_DATA);

  /** Abre el diálogo y normaliza el resultado a boolean. */
  static abrir(dialog: MatDialog, datos: DatosConfirmDialog): Observable<boolean> {
    return dialog
      .open<ConfirmDialogComponent, DatosConfirmDialog, boolean>(ConfirmDialogComponent, {
        data: datos,
        width: '420px',
        autoFocus: false,
      })
      .afterClosed()
      .pipe(map((resultado) => resultado === true));
  }
}
