import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Estado vacío reutilizable: icono + mensaje + acción opcional.
 * El botón solo se muestra si se provee `textoAccion`.
 */
@Component({
  selector: 'app-estado-vacio',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="estado-vacio">
      <mat-icon class="estado-vacio__icono">{{ icono() }}</mat-icon>
      <p class="estado-vacio__mensaje">{{ mensaje() }}</p>
      @if (textoAccion(); as texto) {
        <button mat-stroked-button type="button" (click)="accion.emit()">
          {{ texto }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .estado-vacio {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 48px 16px;
        text-align: center;
        color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      }
      .estado-vacio__icono {
        font-size: 56px;
        width: 56px;
        height: 56px;
        opacity: 0.5;
      }
      .estado-vacio__mensaje {
        margin: 0;
        font-size: 16px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoVacioComponent {
  readonly icono = input('inbox');
  readonly mensaje = input.required<string>();
  /** Si se define, se muestra un botón con este texto que emite `accion`. */
  readonly textoAccion = input<string | null>(null);

  readonly accion = output<void>();
}
