import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Paquete, Saldo, Transaccion, WalletApi } from '../../../core/api';
import {
  ConfirmDialogComponent,
  EstadoVacioComponent,
  extraerMensajeError,
  FechaCortaPipe,
  generarReferenciaExterna,
  MonedaDopPipe,
} from '../../../shared';

const ICONO_POR_TIPO: Record<Transaccion['tipo'], string> = {
  RECARGA: 'add_card',
  ABORDAJE: 'directions_bus',
  DEVOLUCION: 'undo',
};

/**
 * Wallet del pasajero: saldo (GET /wallet/mi-saldo), catálogo de paquetes y
 * compra idempotente (referenciaExterna única generada en el cliente;
 * la respuesta es una unión discriminada por `idempotente`), e historial de
 * transacciones (filas crudas snake_case). Si el backend responde 404 (el
 * usuario no tiene perfil de pasajero) se muestra un estado vacío claro.
 */
@Component({
  selector: 'app-pasajero-wallet',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    EstadoVacioComponent,
    MonedaDopPipe,
    FechaCortaPipe,
  ],
  template: `
    @if (sinPerfil()) {
      <app-estado-vacio
        icono="person_off"
        mensaje="Tu usuario no tiene un perfil de pasajero asociado, por lo que no hay wallet disponible. Contacta a soporte de BusRide."
      />
    } @else {
      <section class="wallet">
        <!-- Saldo -->
        <mat-card class="wallet__saldo">
          <mat-card-content>
            @if (cargandoSaldo()) {
              <mat-progress-spinner diameter="32" mode="indeterminate" />
            } @else if (saldo(); as datos) {
              <div class="wallet__saldo-fila">
                <div class="wallet__saldo-item">
                  <span class="wallet__saldo-valor">{{ datos.saldoViajes }}</span>
                  <span class="wallet__saldo-etiqueta">viajes disponibles</span>
                </div>
                <div class="wallet__saldo-item">
                  <span class="wallet__saldo-valor">{{ datos.saldoDinero | monedaDop }}</span>
                  <span class="wallet__saldo-etiqueta">saldo en dinero</span>
                </div>
              </div>
            } @else if (errorSaldo(); as mensaje) {
              <p class="wallet__error">{{ mensaje }}</p>
            }
          </mat-card-content>
        </mat-card>

        <!-- Paquetes -->
        <h2 class="wallet__subtitulo">Paquetes de viajes</h2>
        <div class="wallet__paquetes">
          @for (paquete of paquetes(); track paquete.id) {
            <mat-card class="wallet__paquete">
              <mat-card-header>
                <mat-card-title>{{ paquete.nombre }}</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <p class="wallet__paquete-precio">{{ paquete.precio | monedaDop }}</p>
                <p>
                  {{ paquete.cantidad_viajes }} viajes
                  @if (paquete.viajes_bono > 0) {
                    <strong>+ {{ paquete.viajes_bono }} de bono</strong>
                  }
                </p>
              </mat-card-content>
              <mat-card-actions align="end">
                <button
                  mat-flat-button
                  type="button"
                  (click)="comprar(paquete)"
                  [disabled]="comprando()"
                >
                  <mat-icon>shopping_cart</mat-icon>
                  Comprar
                </button>
              </mat-card-actions>
            </mat-card>
          } @empty {
            @if (!cargandoPaquetes()) {
              <app-estado-vacio icono="inventory_2" mensaje="No hay paquetes disponibles." />
            }
          }
        </div>

        <!-- Historial -->
        <h2 class="wallet__subtitulo">Historial de transacciones</h2>
        @if (historial().length === 0 && !cargandoHistorial()) {
          <app-estado-vacio icono="receipt_long" mensaje="Aún no tienes transacciones." />
        } @else {
          <mat-card>
            <mat-card-content class="wallet__historial">
              @for (transaccion of historial(); track transaccion.id) {
                <div class="wallet__transaccion">
                  <mat-icon class="wallet__transaccion-icono">
                    {{ iconoTransaccion(transaccion) }}
                  </mat-icon>
                  <div class="wallet__transaccion-datos">
                    <span class="wallet__transaccion-titulo">
                      {{ transaccion.descripcion || transaccion.tipo }}
                    </span>
                    <span class="wallet__transaccion-fecha">
                      {{ transaccion.fecha_creacion | fechaCorta }} · {{ transaccion.estado }}
                    </span>
                  </div>
                  <div class="wallet__transaccion-montos">
                    @if (transaccion.viajes_cantidad !== 0) {
                      <span
                        class="wallet__transaccion-viajes"
                        [class.wallet__transaccion-viajes--negativo]="transaccion.viajes_cantidad < 0"
                      >
                        {{ transaccion.viajes_cantidad > 0 ? '+' : '' }}{{ transaccion.viajes_cantidad }} viaje(s)
                      </span>
                    }
                    @if (transaccion.monto !== null) {
                      <span class="wallet__transaccion-monto">{{ transaccion.monto | monedaDop }}</span>
                    }
                  </div>
                </div>
              }
            </mat-card-content>
          </mat-card>
        }
      </section>
    }
  `,
  styles: [
    `
      .wallet {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 720px;
        margin: 0 auto;
      }
      .wallet__saldo-fila {
        display: flex;
        gap: 24px;
        justify-content: space-around;
        flex-wrap: wrap;
      }
      .wallet__saldo-item {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .wallet__saldo-valor {
        font-size: 28px;
        font-weight: 700;
      }
      .wallet__saldo-etiqueta {
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .wallet__subtitulo {
        margin: 8px 0 0;
        font-size: 16px;
        font-weight: 500;
      }
      .wallet__paquetes {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
      @media (min-width: 600px) {
        .wallet__paquetes {
          grid-template-columns: 1fr 1fr;
        }
      }
      .wallet__paquete-precio {
        font-size: 22px;
        font-weight: 600;
        margin: 4px 0;
      }
      .wallet__historial {
        display: flex;
        flex-direction: column;
      }
      .wallet__transaccion {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }
      .wallet__transaccion:last-child {
        border-bottom: none;
      }
      .wallet__transaccion-icono {
        opacity: 0.6;
      }
      .wallet__transaccion-datos {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .wallet__transaccion-titulo {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wallet__transaccion-fecha {
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .wallet__transaccion-montos {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .wallet__transaccion-viajes {
        font-weight: 600;
        color: var(--mat-sys-primary, #1976d2);
      }
      .wallet__transaccion-viajes--negativo {
        color: var(--mat-sys-error, #b00020);
      }
      .wallet__transaccion-monto {
        font-size: 13px;
      }
      .wallet__error {
        margin: 0;
        color: var(--mat-sys-error, #b00020);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletComponent {
  private readonly walletApi = inject(WalletApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly saldo = signal<Saldo | null>(null);
  protected readonly paquetes = signal<Paquete[]>([]);
  protected readonly historial = signal<Transaccion[]>([]);

  protected readonly cargandoSaldo = signal(false);
  protected readonly cargandoPaquetes = signal(false);
  protected readonly cargandoHistorial = signal(false);
  protected readonly comprando = signal(false);

  /** true cuando el backend devuelve 404: el usuario no tiene perfil de pasajero. */
  protected readonly sinPerfil = signal(false);
  protected readonly errorSaldo = signal('');

  constructor() {
    this.cargarSaldo();
    this.cargarPaquetes();
    this.cargarHistorial();
  }

  protected iconoTransaccion(transaccion: Transaccion): string {
    return ICONO_POR_TIPO[transaccion.tipo] ?? 'receipt';
  }

  private cargarSaldo(): void {
    this.cargandoSaldo.set(true);
    this.walletApi.obtenerMiSaldo().subscribe({
      next: (saldo) => {
        this.saldo.set(saldo);
        this.cargandoSaldo.set(false);
      },
      error: (err: unknown) => {
        this.cargandoSaldo.set(false);
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.sinPerfil.set(true);
          return;
        }
        this.errorSaldo.set(extraerMensajeError(err, 'No se pudo cargar el saldo'));
      },
    });
  }

  private cargarPaquetes(): void {
    this.cargandoPaquetes.set(true);
    this.walletApi.listarPaquetes().subscribe({
      next: (paquetes) => {
        this.paquetes.set(paquetes);
        this.cargandoPaquetes.set(false);
      },
      error: () => this.cargandoPaquetes.set(false),
    });
  }

  private cargarHistorial(): void {
    this.cargandoHistorial.set(true);
    this.walletApi.historial(30).subscribe({
      next: (transacciones) => {
        this.historial.set(transacciones);
        this.cargandoHistorial.set(false);
      },
      error: () => this.cargandoHistorial.set(false),
    });
  }

  comprar(paquete: Paquete): void {
    if (this.comprando()) return;

    ConfirmDialogComponent.abrir(this.dialog, {
      titulo: 'Confirmar compra',
      mensaje: `¿Comprar el paquete "${paquete.nombre}" (${paquete.cantidad_viajes} viajes) por RD$${paquete.precio}?`,
      textoConfirmar: 'Comprar',
    }).subscribe((confirmado) => {
      if (!confirmado) return;
      this.ejecutarCompra(paquete);
    });
  }

  private ejecutarCompra(paquete: Paquete): void {
    this.comprando.set(true);
    // Clave de idempotencia única por intento de compra (util de shared).
    const referenciaExterna = generarReferenciaExterna();

    this.walletApi.comprarPaquete({ paqueteId: paquete.id, referenciaExterna }).subscribe({
      next: (respuesta) => {
        this.comprando.set(false);
        // Unión discriminada por `idempotente`
        if (respuesta.idempotente) {
          this.snackBar.open(
            `Esta compra ya estaba procesada (${respuesta.viajesAcreditados} viajes acreditados).`,
            'OK',
            { duration: 6000 },
          );
        } else {
          this.snackBar.open(
            `¡Compra exitosa! ${respuesta.viajesAcreditados} viajes acreditados · saldo: ${respuesta.saldoViajes} viajes.`,
            'OK',
            { duration: 6000 },
          );
        }
        this.cargarSaldo();
        this.cargarHistorial();
      },
      error: (err: unknown) => {
        this.comprando.set(false);
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.sinPerfil.set(true);
          return;
        }
        this.snackBar.open(extraerMensajeError(err, 'No se pudo completar la compra'), 'OK', {
          duration: 6000,
        });
      },
    });
  }
}
