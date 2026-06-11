import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  ActualizarAsociacionDto,
  Asociacion,
  AsociacionesApi,
  CrearAsociacionDto,
  Usuario,
  UsuariosApi,
} from '../../../../core/api';
import { extraerMensajeError } from '../../mensaje-error.util';
import { etiquetaUsuario, usuariosActivosConRol } from '../../usuarios-por-rol.util';

export interface DatosAsociacionDialog {
  /** Si viene, el diálogo edita; si no, crea. */
  asociacion?: Asociacion;
}

/**
 * Crear/editar asociación (solo admin).
 *
 * El CrearAsociacionDto del backend EXIGE `usuarioId` (el usuario
 * administrador de la asociación, rol asociacion) desde el alta: el selector
 * carga usuarios activos con ese rol. En edición el usuario admin no se toca
 * (se cambia vía PATCH /asociaciones/:id/usuario-admin).
 */
@Component({
  selector: 'app-asociacion-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ esEdicion ? 'Editar asociación' : 'Crear asociación' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="formulario" class="form-dialogo" novalidate>
        @if (!esEdicion) {
          <mat-form-field appearance="outline">
            <mat-label>Usuario administrador (rol asociación)</mat-label>
            <mat-select formControlName="usuarioId">
              @for (usuario of usuarios(); track usuario.id) {
                <mat-option [value]="usuario.id">{{ etiqueta(usuario) }}</mat-option>
              }
            </mat-select>
            @if (formulario.controls.usuarioId.hasError('required')) {
              <mat-error>Selecciona el usuario administrador</mat-error>
            }
            <mat-hint>Si no aparece, créalo primero en «Usuarios» con rol Asociación</mat-hint>
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" maxlength="200" />
          @if (formulario.controls.nombre.hasError('required')) {
            <mat-error>El nombre es obligatorio</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>RNC</mat-label>
          <input matInput formControlName="rnc" maxlength="20" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Dirección</mat-label>
          <input matInput formControlName="direccion" maxlength="300" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Teléfono</mat-label>
          <input matInput formControlName="telefono" maxlength="20" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Comisión de la plataforma (%)</mat-label>
          <input matInput type="number" formControlName="comisionPct" min="0" max="100" step="0.5" />
          @if (
            formulario.controls.comisionPct.hasError('min') ||
            formulario.controls.comisionPct.hasError('max')
          ) {
            <mat-error>Debe estar entre 0 y 100</mat-error>
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
      <button mat-flat-button type="button" [disabled]="cargando()" (click)="guardar()">
        @if (cargando()) {
          <mat-spinner diameter="20" />
        } @else {
          {{ esEdicion ? 'Guardar cambios' : 'Crear' }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form-dialogo {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: min(420px, 80vw);
        padding-top: 8px;
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
export class AsociacionDialogComponent {
  protected readonly dialogRef =
    inject<MatDialogRef<AsociacionDialogComponent, Asociacion>>(MatDialogRef);
  private readonly datos = inject<DatosAsociacionDialog>(MAT_DIALOG_DATA);
  private readonly asociacionesApi = inject(AsociacionesApi);
  private readonly usuariosApi = inject(UsuariosApi);

  protected readonly esEdicion = !!this.datos.asociacion;
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);
  protected readonly etiqueta = etiquetaUsuario;

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    usuarioId: [
      this.datos.asociacion?.usuarioId ?? '',
      this.esEdicion ? [] : [Validators.required],
    ],
    nombre: [this.datos.asociacion?.nombre ?? '', Validators.required],
    rnc: [this.datos.asociacion?.rnc ?? ''],
    direccion: [this.datos.asociacion?.direccion ?? ''],
    telefono: [this.datos.asociacion?.telefono ?? ''],
    comisionPct: [
      this.datos.asociacion ? Number(this.datos.asociacion.comisionPct) : 15,
      [Validators.min(0), Validators.max(100)],
    ],
  });

  constructor() {
    if (!this.esEdicion) {
      usuariosActivosConRol(this.usuariosApi, 'asociacion').subscribe({
        next: (lista) => this.usuarios.set(lista),
        error: (error: unknown) =>
          this.errorBackend.set(
            extraerMensajeError(error, 'No se pudieron cargar los usuarios con rol asociación'),
          ),
      });
    }
  }

  guardar(): void {
    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.errorBackend.set(null);

    const valores = this.formulario.getRawValue();
    const camposComunes: ActualizarAsociacionDto = {
      nombre: valores.nombre.trim(),
      ...(valores.rnc.trim() ? { rnc: valores.rnc.trim() } : {}),
      ...(valores.direccion.trim() ? { direccion: valores.direccion.trim() } : {}),
      ...(valores.telefono.trim() ? { telefono: valores.telefono.trim() } : {}),
      comisionPct: valores.comisionPct,
    };

    const peticion = this.esEdicion
      ? this.asociacionesApi.actualizar(this.datos.asociacion!.id, camposComunes)
      : this.asociacionesApi.crear({
          usuarioId: valores.usuarioId,
          ...camposComunes,
        } as CrearAsociacionDto);

    peticion.subscribe({
      next: (asociacion) => this.dialogRef.close(asociacion),
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorBackend.set(extraerMensajeError(error, 'No se pudo guardar la asociación'));
      },
    });
  }
}
