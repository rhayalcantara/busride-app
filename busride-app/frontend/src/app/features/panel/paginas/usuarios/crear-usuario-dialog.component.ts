import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { AuthApi, UsuarioCreadoRespuesta } from '../../../../core/api';
import { extraerMensajeError } from '../../mensaje-error.util';

/** Roles de la tabla `roles` del backend (1=admin, 2=asociacion, 3=conductor, 4=pasajero). */
const ROLES_DISPONIBLES = [
  { rolId: 2, nombre: 'Asociación' },
  { rolId: 3, nombre: 'Conductor' },
  { rolId: 1, nombre: 'Administrador' },
  { rolId: 4, nombre: 'Pasajero' },
] as const;

/**
 * Alta de usuario privilegiado (POST /auth/usuarios, solo admin).
 * Espeja el CrearUsuarioDto del backend: email, password (≥8), nombre,
 * apellido y rolId. Cierra devolviendo la respuesta del backend.
 */
@Component({
  selector: 'app-crear-usuario-dialog',
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
    <h2 mat-dialog-title>Crear usuario</h2>
    <mat-dialog-content>
      <form [formGroup]="formulario" class="form-dialogo" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="off" />
          @if (formulario.controls.email.hasError('required')) {
            <mat-error>El email es obligatorio</mat-error>
          } @else if (formulario.controls.email.hasError('email')) {
            <mat-error>El email no tiene un formato válido</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Contraseña</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          @if (formulario.controls.password.hasError('required')) {
            <mat-error>La contraseña es obligatoria</mat-error>
          } @else if (formulario.controls.password.hasError('minlength')) {
            <mat-error>Mínimo 8 caracteres</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" />
          @if (formulario.controls.nombre.hasError('required')) {
            <mat-error>El nombre es obligatorio</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Apellido</mat-label>
          <input matInput formControlName="apellido" />
          @if (formulario.controls.apellido.hasError('required')) {
            <mat-error>El apellido es obligatorio</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Rol</mat-label>
          <mat-select formControlName="rolId">
            @for (rol of roles; track rol.rolId) {
              <mat-option [value]="rol.rolId">{{ rol.nombre }}</mat-option>
            }
          </mat-select>
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
          Crear
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form-dialogo {
        display: flex;
        flex-direction: column;
        min-width: min(380px, 80vw);
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
export class CrearUsuarioDialogComponent {
  protected readonly dialogRef =
    inject<MatDialogRef<CrearUsuarioDialogComponent, UsuarioCreadoRespuesta>>(MatDialogRef);
  private readonly authApi = inject(AuthApi);

  protected readonly roles = ROLES_DISPONIBLES;
  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    rolId: [2, Validators.required],
  });

  guardar(): void {
    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.errorBackend.set(null);

    this.authApi.crearUsuario(this.formulario.getRawValue()).subscribe({
      next: (respuesta) => this.dialogRef.close(respuesta),
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorBackend.set(extraerMensajeError(error, 'No se pudo crear el usuario'));
      },
    });
  }
}
