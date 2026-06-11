import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** Página 404: ruta inexistente. El enlace a '' redirige según la sesión. */
@Component({
  selector: 'app-no-encontrada',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="no-encontrada">
      <mat-icon class="no-encontrada__icono">wrong_location</mat-icon>
      <h1>404 — Página no encontrada</h1>
      <p>La ruta solicitada no existe.</p>
      <a mat-flat-button routerLink="/">Ir al inicio</a>
    </div>
  `,
  styles: [
    `
      .no-encontrada {
        display: grid;
        place-items: center;
        align-content: center;
        gap: 8px;
        min-height: 100dvh;
        text-align: center;
        padding: 16px;
        box-sizing: border-box;
      }
      .no-encontrada__icono {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: var(--mat-sys-primary, #1976d2);
      }
      h1 {
        margin: 0;
      }
      p {
        margin: 0 0 8px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoEncontradaComponent {}
