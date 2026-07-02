import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Asociacion, AsociacionesApi, Usuario, UsuariosApi } from '../../../../core/api';
import { etiquetaUsuario, usuariosActivosConRol } from '../../usuarios-por-rol.util';
import { extraerMensajeError } from '../../../../shared';

export interface DatosVincularAdminDialog {
  asociacion: Asociacion;
}

/**
 * Vincular el usuario administrador de una asociación
 * (PATCH /asociaciones/:id/usuario-admin, solo admin). El selector ofrece
 * usuarios activos con rol asociación.
 */
@Component({
  selector: 'app-vincular-admin-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Vincular usuario administrador</h2>
    <mat-dialog-content>
      <p class="vincular__contexto">
        Asociación: <strong>{{ datos.asociacion.nombre }}</strong>
      </p>
      <mat-form-field appearance="outline" class="vincular__campo">
        <mat-label>Usuario (rol asociación)</mat-label>
        <mat-select [formControl]="usuarioControl">
          @for (usuario of usuarios(); track usuario.id) {
            <mat-option [value]="usuario.id">{{ etiqueta(usuario) }}</mat-option>
          }
        </mat-select>
        @if (usuarioControl.hasError('required')) {
          <mat-error>Selecciona un usuario</mat-error>
        }
        <mat-hint>Si no aparece, créalo en «Usuarios» con rol Asociación</mat-hint>
      </mat-form-field>

      @if (errorBackend(); as mensaje) {
        <p class="error-dialogo" role="alert">{{ mensaje }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [disabled]="cargando()" (click)="dialogRef.close()">
        Cancelar
      </button>
      <button mat-flat-button type="button" [disabled]="cargando()" (click)="vincular()">
        @if (cargando()) {
          <mat-spinner diameter="20" />
        } @else {
          Vincular
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .vincular__contexto {
        margin: 0 0 12px;
      }
      .vincular__campo {
        width: 100%;
        min-width: min(380px, 80vw);
      }
      .error-dialogo {
        color: var(--mat-sys-error, #b3261e);
        font-size: 14px;
        margin: 8px 0 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VincularAdminDialogComponent {
  protected readonly dialogRef =
    inject<MatDialogRef<VincularAdminDialogComponent, Asociacion>>(MatDialogRef);
  protected readonly datos = inject<DatosVincularAdminDialog>(MAT_DIALOG_DATA);
  private readonly asociacionesApi = inject(AsociacionesApi);
  private readonly usuariosApi = inject(UsuariosApi);

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);
  protected readonly etiqueta = etiquetaUsuario;

  protected readonly usuarioControl = new FormControl(this.datos.asociacion.usuarioId, {
    nonNullable: true,
    validators: [Validators.required],
  });

  constructor() {
    usuariosActivosConRol(this.usuariosApi, 'asociacion').subscribe({
      next: (lista) => this.usuarios.set(lista),
      error: (error: unknown) =>
        this.errorBackend.set(
          extraerMensajeError(error, 'No se pudieron cargar los usuarios con rol asociación'),
        ),
    });
  }

  vincular(): void {
    if (this.usuarioControl.invalid || this.cargando()) {
      this.usuarioControl.markAsTouched();
      return;
    }
    this.cargando.set(true);
    this.errorBackend.set(null);

    this.asociacionesApi
      .vincularUsuarioAdmin(this.datos.asociacion.id, this.usuarioControl.value)
      .subscribe({
        next: (asociacion) => this.dialogRef.close(asociacion),
        error: (error: unknown) => {
          this.cargando.set(false);
          this.errorBackend.set(extraerMensajeError(error, 'No se pudo vincular el usuario'));
        },
      });
  }
}
