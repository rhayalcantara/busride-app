import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  ConductorCreadoRespuesta,
  ConductoresApi,
  CrearConductorDto,
  Usuario,
  UsuariosApi,
} from '../../../../core/api';
import { etiquetaUsuario, usuariosActivosConRol } from '../../usuarios-por-rol.util';
import { extraerMensajeError } from '../../../../shared';

export interface DatosCrearConductorDialog {
  asociacionId: string;
  asociacionNombre: string;
  /** GET /usuarios es admin-only: con rol asociacion el usuarioId se escribe a mano. */
  esAdmin: boolean;
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Alta de conductor (POST /conductores). Espeja CrearConductorDto del
 * backend: usuarioId (usuario existente con rol conductor), asociacionId,
 * licenciaNumero (≤50, única), licenciaVence (YYYY-MM-DD) y opcionales
 * fotoUrl, cuentaBancaria, banco.
 */
@Component({
  selector: 'app-crear-conductor-dialog',
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
    <h2 mat-dialog-title>Registrar conductor</h2>
    <mat-dialog-content>
      <p class="dialogo-contexto">
        Asociación: <strong>{{ datos.asociacionNombre }}</strong>
      </p>
      <form [formGroup]="formulario" class="form-dialogo" novalidate>
        @if (datos.esAdmin) {
          <mat-form-field appearance="outline">
            <mat-label>Usuario (rol conductor)</mat-label>
            <mat-select formControlName="usuarioId">
              @for (usuario of usuarios(); track usuario.id) {
                <mat-option [value]="usuario.id">{{ etiqueta(usuario) }}</mat-option>
              }
            </mat-select>
            @if (formulario.controls.usuarioId.hasError('required')) {
              <mat-error>Selecciona el usuario</mat-error>
            }
            <mat-hint>Si no aparece, créalo en «Usuarios» con rol Conductor</mat-hint>
          </mat-form-field>
        } @else {
          <mat-form-field appearance="outline">
            <mat-label>ID del usuario conductor (UUID)</mat-label>
            <input
              matInput
              formControlName="usuarioId"
              placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx"
            />
            @if (formulario.controls.usuarioId.hasError('required')) {
              <mat-error>El ID del usuario es obligatorio</mat-error>
            } @else if (formulario.controls.usuarioId.hasError('pattern')) {
              <mat-error>Debe ser un UUID v4 válido</mat-error>
            }
            <mat-hint>Pídele el ID al administrador (tu rol no puede listar usuarios)</mat-hint>
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Número de licencia</mat-label>
          <input matInput formControlName="licenciaNumero" maxlength="50" />
          @if (formulario.controls.licenciaNumero.hasError('required')) {
            <mat-error>El número de licencia es obligatorio</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Vencimiento de la licencia</mat-label>
          <input matInput type="date" formControlName="licenciaVence" />
          @if (formulario.controls.licenciaVence.hasError('required')) {
            <mat-error>La fecha de vencimiento es obligatoria</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>URL de foto (opcional)</mat-label>
          <input matInput formControlName="fotoUrl" maxlength="500" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Cuenta bancaria (opcional)</mat-label>
          <input matInput formControlName="cuentaBancaria" maxlength="30" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Banco (opcional)</mat-label>
          <input matInput formControlName="banco" maxlength="100" />
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
          Registrar
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialogo-contexto {
        margin: 0 0 12px;
      }
      .form-dialogo {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: min(420px, 80vw);
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
export class CrearConductorDialogComponent {
  protected readonly dialogRef =
    inject<MatDialogRef<CrearConductorDialogComponent, ConductorCreadoRespuesta>>(MatDialogRef);
  protected readonly datos = inject<DatosCrearConductorDialog>(MAT_DIALOG_DATA);
  private readonly conductoresApi = inject(ConductoresApi);
  private readonly usuariosApi = inject(UsuariosApi);

  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);
  protected readonly etiqueta = etiquetaUsuario;

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    usuarioId: [
      '',
      this.datos.esAdmin
        ? [Validators.required]
        : [Validators.required, Validators.pattern(UUID_V4_REGEX)],
    ],
    licenciaNumero: ['', Validators.required],
    licenciaVence: ['', Validators.required],
    fotoUrl: [''],
    cuentaBancaria: [''],
    banco: [''],
  });

  constructor() {
    if (this.datos.esAdmin) {
      usuariosActivosConRol(this.usuariosApi, 'conductor').subscribe({
        next: (lista) => this.usuarios.set(lista),
        error: (error: unknown) =>
          this.errorBackend.set(
            extraerMensajeError(error, 'No se pudieron cargar los usuarios con rol conductor'),
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
    const dto: CrearConductorDto = {
      usuarioId: valores.usuarioId.trim(),
      asociacionId: this.datos.asociacionId,
      licenciaNumero: valores.licenciaNumero.trim(),
      licenciaVence: valores.licenciaVence,
      ...(valores.fotoUrl.trim() ? { fotoUrl: valores.fotoUrl.trim() } : {}),
      ...(valores.cuentaBancaria.trim() ? { cuentaBancaria: valores.cuentaBancaria.trim() } : {}),
      ...(valores.banco.trim() ? { banco: valores.banco.trim() } : {}),
    };

    this.conductoresApi.crear(dto).subscribe({
      next: (respuesta) => this.dialogRef.close(respuesta),
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorBackend.set(extraerMensajeError(error, 'No se pudo registrar el conductor'));
      },
    });
  }
}
