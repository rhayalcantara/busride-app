import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService, HOME_POR_ROL } from '../../../core/auth';
import { extraerMensajeError } from '../../../shared';

/**
 * Página de inicio de sesión. Tras autenticar redirige a la home del rol
 * (HOME_POR_ROL) o a `?volverA=` si el authGuard guardó una URL destino.
 */
@Component({
  selector: 'app-login',
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
            BusRide
          </mat-card-title>
          <mat-card-subtitle>Inicia sesión para continuar</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="formulario" (ngSubmit)="enviar()" novalidate>
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
                autocomplete="current-password"
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
              @if (formulario.controls.password.hasError('required')) {
                <mat-error>La contraseña es obligatoria</mat-error>
              }
            </mat-form-field>

            @if (errorBackend(); as mensaje) {
              <p class="pagina-auth__error" role="alert">{{ mensaje }}</p>
            }

            <button
              mat-flat-button
              class="full-width"
              type="submit"
              [disabled]="cargando()"
            >
              @if (cargando()) {
                <mat-spinner diameter="20" />
              } @else {
                Iniciar sesión
              }
            </button>
          </form>
        </mat-card-content>

        <mat-card-actions class="pagina-auth__acciones">
          <span>¿No tienes cuenta?</span>
          <a mat-button routerLink="/registro">Regístrate como pasajero</a>
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
      mat-spinner {
        display: inline-block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly rutaActiva = inject(ActivatedRoute);

  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);
  protected readonly ocultarPassword = signal(true);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  /** Valida el formulario y, si es correcto, llama a POST /auth/login. */
  enviar(): void {
    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.errorBackend.set(null);

    this.auth.login(this.formulario.getRawValue()).subscribe({
      next: (respuesta) => {
        // Respeta ?volverA= (lo añade authGuard al expulsar a /login);
        // si no viene, a la home del rol autenticado.
        const volverA = this.rutaActiva.snapshot.queryParamMap.get('volverA');
        void this.router.navigateByUrl(volverA ?? HOME_POR_ROL[respuesta.usuario.rol]);
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorBackend.set(extraerMensajeError(error, 'No se pudo iniciar sesión'));
      },
    });
  }
}
