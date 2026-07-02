import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth';
import { extraerMensajeError } from '../../../shared';

/**
 * Registro público de PASAJEROS (el backend no acepta otros roles aquí).
 * Validaciones espejo del RegistrarDto: email válido, contraseña ≥ 8
 * caracteres, nombre y apellido obligatorios. Tras registrar con éxito hace
 * login automático con las mismas credenciales y entra a /pasajero.
 */
@Component({
  selector: 'app-registro',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="pagina-auth">
      <mat-card class="pagina-auth__card" appearance="outlined">
        <mat-card-header>
          <mat-card-title>
            <mat-icon class="pagina-auth__logo">directions_bus</mat-icon>
            Crear cuenta
          </mat-card-title>
          <mat-card-subtitle>Regístrate como pasajero de BusRide</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="formulario" (ngSubmit)="enviar()" novalidate>
            <mat-form-field class="full-width" appearance="outline">
              <mat-label>Nombre</mat-label>
              <input matInput formControlName="nombre" autocomplete="given-name" />
              @if (formulario.controls.nombre.hasError('required')) {
                <mat-error>El nombre es obligatorio</mat-error>
              }
            </mat-form-field>

            <mat-form-field class="full-width" appearance="outline">
              <mat-label>Apellido</mat-label>
              <input matInput formControlName="apellido" autocomplete="family-name" />
              @if (formulario.controls.apellido.hasError('required')) {
                <mat-error>El apellido es obligatorio</mat-error>
              }
            </mat-form-field>

            <mat-form-field class="full-width" appearance="outline">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                autocomplete="email"
                placeholder="usuario@correo.com"
              />
              @if (formulario.controls.email.hasError('required')) {
                <mat-error>El email es obligatorio</mat-error>
              } @else if (formulario.controls.email.hasError('email')) {
                <mat-error>El email no tiene un formato válido</mat-error>
              }
            </mat-form-field>

            <mat-form-field class="full-width" appearance="outline">
              <mat-label>Contraseña</mat-label>
              <input
                matInput
                [type]="ocultarPassword() ? 'password' : 'text'"
                formControlName="password"
                autocomplete="new-password"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                [attr.aria-label]="ocultarPassword() ? 'Mostrar contraseña' : 'Ocultar contraseña'"
                (click)="ocultarPassword.set(!ocultarPassword())"
              >
                <mat-icon>{{ ocultarPassword() ? 'visibility' : 'visibility_off' }}</mat-icon>
              </button>
              <mat-hint>Mínimo 8 caracteres</mat-hint>
              @if (formulario.controls.password.hasError('required')) {
                <mat-error>La contraseña es obligatoria</mat-error>
              } @else if (formulario.controls.password.hasError('minlength')) {
                <mat-error>La contraseña debe tener al menos 8 caracteres</mat-error>
              }
            </mat-form-field>

            @if (errorBackend(); as mensaje) {
              <p class="pagina-auth__error" role="alert">{{ mensaje }}</p>
            }

            <button mat-flat-button class="full-width" type="submit" [disabled]="cargando()">
              @if (cargando()) {
                <mat-spinner diameter="20" />
              } @else {
                Crear cuenta
              }
            </button>
          </form>
        </mat-card-content>

        <mat-card-actions class="pagina-auth__acciones">
          <span>¿Ya tienes cuenta?</span>
          <a mat-button routerLink="/login">Inicia sesión</a>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .pagina-auth {
        display: grid;
        place-items: center;
        min-height: 100dvh;
        padding: 16px;
        box-sizing: border-box;
      }
      .pagina-auth__card {
        width: 100%;
        max-width: 400px;
      }
      .pagina-auth__logo {
        vertical-align: middle;
        margin-right: 4px;
      }
      .pagina-auth__error {
        color: var(--mat-sys-error, #b3261e);
        font-size: 14px;
        margin: 0 0 12px;
      }
      .pagina-auth__acciones {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        flex-wrap: wrap;
      }
      mat-card-content form {
        display: flex;
        flex-direction: column;
        margin-top: 16px;
      }
      mat-form-field {
        margin-bottom: 4px;
      }
      mat-spinner {
        display: inline-block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);
  protected readonly ocultarPassword = signal(true);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  /** Registra al pasajero y, si va bien, inicia sesión automáticamente. */
  enviar(): void {
    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.errorBackend.set(null);
    const datos = this.formulario.getRawValue();

    this.auth
      .registrar(datos)
      .pipe(switchMap(() => this.auth.login({ email: datos.email, password: datos.password })))
      .subscribe({
        next: () => void this.router.navigateByUrl('/pasajero'),
        error: (error: unknown) => {
          this.cargando.set(false);
          this.errorBackend.set(extraerMensajeError(error, 'No se pudo completar el registro'));
        },
      });
  }
}
