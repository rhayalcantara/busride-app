import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService, HOME_POR_ROL } from '../../../core/auth';
import { extraerMensajeError } from '../../../shared';

/**
 * La nueva contraseña debe ser DISTINTA de la actual (espejo del backend).
 * Validador a nivel de control: mira al hermano `passwordActual` vía parent.
 */
function distintaDeActual(control: AbstractControl): ValidationErrors | null {
  const actual = control.parent?.get('passwordActual')?.value as string | undefined;
  return actual && control.value === actual ? { igualQueActual: true } : null;
}

/** La confirmación debe coincidir con `passwordNueva`. */
function coincideConNueva(control: AbstractControl): ValidationErrors | null {
  const nueva = control.parent?.get('passwordNueva')?.value as string | undefined;
  return control.value !== nueva ? { noCoincide: true } : null;
}

/**
 * Cambio de contraseña del usuario autenticado (POST /auth/cambiar-password).
 * Se usa como paso OBLIGATORIO cuando el login devuelve
 * `usuario.debeCambiarPassword`. Validaciones espejo del backend: nueva ≥ 8
 * caracteres y distinta de la actual (+ confirmación local). Al éxito, el
 * AuthService ya persistió el par de tokens NUEVO; aquí se redirige a
 * `?volverA=` (si el login lo propagó) o a la home del rol.
 */
@Component({
  selector: 'app-cambiar-password',
  imports: [
    ReactiveFormsModule,
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
            <mat-icon class="pagina-auth__logo">lock_reset</mat-icon>
            Cambiar contraseña
          </mat-card-title>
          <mat-card-subtitle>
            Por seguridad debes definir una contraseña nueva para continuar
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <form [formGroup]="formulario" (ngSubmit)="enviar()" novalidate>
            <mat-form-field class="full-width" appearance="outline">
              <mat-label>Contraseña actual</mat-label>
              <input
                matInput
                [type]="ocultarActual() ? 'password' : 'text'"
                formControlName="passwordActual"
                autocomplete="current-password"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                [attr.aria-label]="ocultarActual() ? 'Mostrar contraseña' : 'Ocultar contraseña'"
                (click)="ocultarActual.set(!ocultarActual())"
              >
                <mat-icon>{{ ocultarActual() ? 'visibility' : 'visibility_off' }}</mat-icon>
              </button>
              @if (formulario.controls.passwordActual.hasError('required')) {
                <mat-error>La contraseña actual es obligatoria</mat-error>
              }
            </mat-form-field>

            <mat-form-field class="full-width" appearance="outline">
              <mat-label>Contraseña nueva</mat-label>
              <input
                matInput
                [type]="ocultarNueva() ? 'password' : 'text'"
                formControlName="passwordNueva"
                autocomplete="new-password"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                [attr.aria-label]="ocultarNueva() ? 'Mostrar contraseña' : 'Ocultar contraseña'"
                (click)="ocultarNueva.set(!ocultarNueva())"
              >
                <mat-icon>{{ ocultarNueva() ? 'visibility' : 'visibility_off' }}</mat-icon>
              </button>
              <mat-hint>Mínimo 8 caracteres, distinta de la actual</mat-hint>
              @if (formulario.controls.passwordNueva.hasError('required')) {
                <mat-error>La contraseña nueva es obligatoria</mat-error>
              } @else if (formulario.controls.passwordNueva.hasError('minlength')) {
                <mat-error>La contraseña nueva debe tener al menos 8 caracteres</mat-error>
              } @else if (formulario.controls.passwordNueva.hasError('igualQueActual')) {
                <mat-error>La contraseña nueva debe ser distinta de la actual</mat-error>
              }
            </mat-form-field>

            <mat-form-field class="full-width" appearance="outline">
              <mat-label>Confirmar contraseña nueva</mat-label>
              <input
                matInput
                [type]="ocultarConfirmacion() ? 'password' : 'text'"
                formControlName="confirmacion"
                autocomplete="new-password"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                [attr.aria-label]="
                  ocultarConfirmacion() ? 'Mostrar contraseña' : 'Ocultar contraseña'
                "
                (click)="ocultarConfirmacion.set(!ocultarConfirmacion())"
              >
                <mat-icon>{{ ocultarConfirmacion() ? 'visibility' : 'visibility_off' }}</mat-icon>
              </button>
              @if (formulario.controls.confirmacion.hasError('required')) {
                <mat-error>Confirma la contraseña nueva</mat-error>
              } @else if (formulario.controls.confirmacion.hasError('noCoincide')) {
                <mat-error>La confirmación no coincide con la contraseña nueva</mat-error>
              }
            </mat-form-field>

            @if (errorBackend(); as mensaje) {
              <p class="pagina-auth__error" role="alert">{{ mensaje }}</p>
            }

            <button mat-flat-button class="full-width" type="submit" [disabled]="cargando()">
              @if (cargando()) {
                <mat-spinner diameter="20" />
              } @else {
                Cambiar contraseña
              }
            </button>
          </form>
        </mat-card-content>

        <mat-card-actions class="pagina-auth__acciones">
          <span>¿No eres tú?</span>
          <button mat-button type="button" (click)="cerrarSesion()">Cerrar sesión</button>
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
export class CambiarPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly rutaActiva = inject(ActivatedRoute);

  protected readonly cargando = signal(false);
  protected readonly errorBackend = signal<string | null>(null);
  protected readonly ocultarActual = signal(true);
  protected readonly ocultarNueva = signal(true);
  protected readonly ocultarConfirmacion = signal(true);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    passwordActual: ['', [Validators.required]],
    passwordNueva: ['', [Validators.required, Validators.minLength(8), distintaDeActual]],
    confirmacion: ['', [Validators.required, coincideConNueva]],
  });

  constructor() {
    // Los validadores cruzados miran a un control hermano: revalidar el
    // dependiente cuando cambia la fuente (Angular no lo hace solo).
    this.formulario.controls.passwordActual.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formulario.controls.passwordNueva.updateValueAndValidity());
    this.formulario.controls.passwordNueva.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formulario.controls.confirmacion.updateValueAndValidity());
  }

  /** Valida el formulario y llama a POST /auth/cambiar-password. */
  enviar(): void {
    if (this.formulario.invalid || this.cargando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.errorBackend.set(null);
    const { passwordActual, passwordNueva } = this.formulario.getRawValue();

    this.auth.cambiarPassword(passwordActual, passwordNueva).subscribe({
      next: () => {
        // Igual que el login: respeta ?volverA= si viene; si no, home del rol.
        const volverA = this.rutaActiva.snapshot.queryParamMap.get('volverA');
        const rol = this.auth.rol();
        void this.router.navigateByUrl(volverA ?? (rol ? HOME_POR_ROL[rol] : '/login'));
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.errorBackend.set(extraerMensajeError(error, 'No se pudo cambiar la contraseña'));
      },
    });
  }

  /** Sale sin cambiar la contraseña (revoca la sesión) y vuelve a /login. */
  protected cerrarSesion(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
