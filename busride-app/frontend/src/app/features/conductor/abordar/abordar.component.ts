import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { AbordajeConfirmado, ReservasApi } from '../../../core/api';
import { MonedaDopPipe } from '../../../shared';
import { extraerMensajeError } from '../../auth/mensaje-error.util';

/**
 * Abordaje de pasajeros: escáner QR con la cámara trasera (@zxing/browser)
 * y fallback SIEMPRE visible para pegar el token manualmente. Con el token
 * capturado se pide el número de asiento y se confirma contra
 * POST /reservas/abordar (sp_confirmar_abordaje).
 */
@Component({
  selector: 'app-abordar',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MonedaDopPipe,
  ],
  template: `
    <h2 class="abordar__titulo">Abordar pasajero</h2>

    @if (resultado(); as abordaje) {
      <!-- Éxito: ticket emitido -->
      <mat-card class="abordar__exito" appearance="outlined">
        <mat-card-content>
          <mat-icon class="abordar__exito-icono">check_circle</mat-icon>
          <h3>¡Abordaje confirmado!</h3>
          <dl class="abordar__ticket">
            <div>
              <dt>Ticket</dt>
              <dd class="abordar__ticket-codigo">{{ abordaje.ticketCodigo }}</dd>
            </div>
            <div>
              <dt>Asiento</dt>
              <dd>{{ abordaje.asiento }}</dd>
            </div>
            <div>
              <dt>Monto</dt>
              <dd>{{ abordaje.monto | monedaDop }}</dd>
            </div>
            <div>
              <dt>Asientos restantes</dt>
              <dd>{{ abordaje.asientosRestantes }}</dd>
            </div>
          </dl>
        </mat-card-content>
        <mat-card-actions>
          <button mat-flat-button type="button" (click)="abordarOtro()">
            <mat-icon>qr_code_scanner</mat-icon>
            Abordar otro pasajero
          </button>
        </mat-card-actions>
      </mat-card>
    } @else if (qrToken(); as token) {
      <!-- Token capturado: pedir asiento y confirmar -->
      <mat-card appearance="outlined">
        <mat-card-content>
          <p class="abordar__token-ok">
            <mat-icon inline>task_alt</mat-icon>
            Token del QR capturado ({{ token.length }} caracteres).
          </p>
          <form [formGroup]="formularioAsiento" (ngSubmit)="confirmar()" novalidate>
            <mat-form-field class="full-width" appearance="outline">
              <mat-label>Número de asiento</mat-label>
              <input
                matInput
                type="number"
                inputmode="numeric"
                min="1"
                formControlName="numeroAsiento"
              />
              @if (formularioAsiento.controls.numeroAsiento.hasError('required')) {
                <mat-error>Indica el asiento asignado</mat-error>
              } @else if (formularioAsiento.controls.numeroAsiento.hasError('min')) {
                <mat-error>El asiento debe ser 1 o mayor</mat-error>
              }
            </mat-form-field>

            @if (errorAbordaje(); as mensaje) {
              <p class="abordar__error" role="alert">{{ mensaje }}</p>
            }

            <div class="abordar__acciones">
              <button mat-flat-button type="submit" [disabled]="confirmando()">
                @if (confirmando()) {
                  <mat-spinner diameter="20" />
                } @else {
                  Confirmar abordaje
                }
              </button>
              <button mat-stroked-button type="button" (click)="cambiarToken()">
                Cambiar token
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    } @else {
      <!-- Captura: escáner + fallback manual siempre visible -->
      <mat-card appearance="outlined">
        <mat-card-content>
          <div class="abordar__video-marco" [class.abordar__video-marco--activo]="escaneando()">
            <video #video class="abordar__video" muted playsinline></video>
            @if (!escaneando()) {
              <div class="abordar__video-overlay">
                <mat-icon>photo_camera</mat-icon>
                <span>La cámara está apagada</span>
              </div>
            }
          </div>

          @if (errorCamara(); as mensaje) {
            <p class="abordar__error" role="alert">{{ mensaje }}</p>
          }

          @if (escaneando()) {
            <button mat-stroked-button class="full-width" type="button" (click)="detenerEscaner()">
              <mat-icon>stop_circle</mat-icon>
              Detener escáner
            </button>
          } @else {
            <button mat-flat-button class="full-width" type="button" (click)="iniciarEscaner()">
              <mat-icon>qr_code_scanner</mat-icon>
              Escanear QR con la cámara
            </button>
          }
        </mat-card-content>
      </mat-card>

      <mat-card class="abordar__manual" appearance="outlined">
        <mat-card-content>
          <p class="abordar__manual-titulo">¿Sin cámara? Pega el token del QR:</p>
          <form [formGroup]="formularioToken" (ngSubmit)="usarTokenManual()" novalidate>
            <mat-form-field class="full-width" appearance="outline">
              <mat-label>Token del QR</mat-label>
              <textarea
                matInput
                rows="3"
                formControlName="token"
                placeholder="Pega aquí el qrToken de la reserva"
              ></textarea>
              @if (formularioToken.controls.token.hasError('required')) {
                <mat-error>Pega el token de la reserva</mat-error>
              }
            </mat-form-field>
            <button mat-stroked-button class="full-width" type="submit">
              Usar este token
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 480px;
        margin: 0 auto;
      }
      .abordar__titulo {
        margin: 0 0 16px;
      }
      .full-width {
        width: 100%;
      }
      .abordar__video-marco {
        position: relative;
        width: 100%;
        aspect-ratio: 4 / 3;
        margin-bottom: 12px;
        border-radius: 12px;
        overflow: hidden;
        background: #000;
      }
      .abordar__video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .abordar__video-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: #fff;
        opacity: 0.8;
      }
      .abordar__manual {
        margin-top: 16px;
      }
      .abordar__manual-titulo {
        margin: 0 0 12px;
      }
      .abordar__token-ok {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 16px;
        color: var(--mat-sys-primary, #1976d2);
      }
      .abordar__error {
        color: var(--mat-sys-error, #b3261e);
        margin: 0 0 12px;
      }
      .abordar__acciones {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .abordar__exito mat-card-content {
        text-align: center;
      }
      .abordar__exito-icono {
        font-size: 56px;
        width: 56px;
        height: 56px;
        color: #2e7d32;
      }
      .abordar__ticket {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin: 16px 0 0;
        text-align: left;
      }
      .abordar__ticket dt {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .abordar__ticket dd {
        margin: 2px 0 0;
        font-size: 18px;
        font-weight: 600;
      }
      .abordar__ticket-codigo {
        word-break: break-all;
        font-size: 16px;
      }
      mat-spinner {
        display: inline-block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AbordarComponent {
  private readonly reservasApi = inject(ReservasApi);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  protected readonly escaneando = signal(false);
  protected readonly errorCamara = signal<string | null>(null);
  protected readonly qrToken = signal<string | null>(null);
  protected readonly confirmando = signal(false);
  protected readonly errorAbordaje = signal<string | null>(null);
  protected readonly resultado = signal<AbordajeConfirmado | null>(null);

  protected readonly formularioToken = this.formBuilder.group({
    token: ['', [Validators.required]],
  });

  protected readonly formularioAsiento = this.formBuilder.group({
    numeroAsiento: [1, [Validators.required, Validators.min(1)]],
  });

  /** Controles del stream de @zxing/browser para poder detenerlo. */
  private controlesEscaner: IScannerControls | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detenerEscaner());
  }

  /** Arranca el lector QR sobre la cámara trasera (facingMode environment). */
  async iniciarEscaner(): Promise<void> {
    const video = this.video()?.nativeElement;
    if (!video || this.escaneando()) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorCamara.set(
        'Este navegador no permite usar la cámara. Pega el token manualmente.',
      );
      return;
    }

    this.errorCamara.set(null);
    this.escaneando.set(true);

    try {
      const lector = new BrowserQRCodeReader();
      this.controlesEscaner = await lector.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        video,
        (lectura) => {
          if (lectura) {
            this.alCapturarToken(lectura.getText());
          }
        },
      );
    } catch (error: unknown) {
      this.escaneando.set(false);
      this.errorCamara.set(this.mensajeErrorCamara(error));
    }
  }

  detenerEscaner(): void {
    this.controlesEscaner?.stop();
    this.controlesEscaner = null;
    this.escaneando.set(false);
  }

  usarTokenManual(): void {
    if (this.formularioToken.invalid) {
      this.formularioToken.markAllAsTouched();
      return;
    }
    this.alCapturarToken(this.formularioToken.getRawValue().token.trim());
  }

  confirmar(): void {
    const qrToken = this.qrToken();
    if (!qrToken || this.confirmando()) return;
    if (this.formularioAsiento.invalid) {
      this.formularioAsiento.markAllAsTouched();
      return;
    }

    this.confirmando.set(true);
    this.errorAbordaje.set(null);

    this.reservasApi
      .confirmarAbordaje({
        qrToken,
        numeroAsiento: Number(this.formularioAsiento.getRawValue().numeroAsiento),
      })
      .subscribe({
        next: (abordaje) => {
          this.confirmando.set(false);
          this.resultado.set(abordaje);
        },
        error: (err: unknown) => {
          this.confirmando.set(false);
          // El SP devuelve el motivo en `mensaje` → 400 con message del backend
          this.errorAbordaje.set(
            extraerMensajeError(err, 'No se pudo confirmar el abordaje'),
          );
        },
      });
  }

  /** Vuelve a la captura de token conservando la pantalla limpia. */
  cambiarToken(): void {
    this.qrToken.set(null);
    this.errorAbordaje.set(null);
    this.formularioToken.reset();
  }

  abordarOtro(): void {
    this.resultado.set(null);
    this.cambiarToken();
    this.formularioAsiento.reset({ numeroAsiento: 1 });
  }

  private alCapturarToken(token: string): void {
    if (!token) return;
    this.detenerEscaner();
    this.qrToken.set(token);
    this.errorAbordaje.set(null);
  }

  private mensajeErrorCamara(error: unknown): string {
    const nombre = (error as { name?: string } | null)?.name;
    switch (nombre) {
      case 'NotAllowedError':
        return 'Permiso de cámara denegado. Autorízalo en el navegador o pega el token manualmente.';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'No se encontró una cámara disponible. Pega el token manualmente.';
      case 'NotReadableError':
        return 'La cámara está en uso por otra aplicación. Ciérrala o pega el token manualmente.';
      default:
        return 'No se pudo iniciar la cámara. Pega el token manualmente.';
    }
  }
}
