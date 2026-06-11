import { Component } from '@angular/core';

// Placeholder temporal: F-05 (Ola F3) lo reemplaza por la página real de login.
@Component({
  selector: 'app-login-placeholder',
  template: `
    <div class="contenedor">
      <h1>BusRide</h1>
      <p>Frontend en construcción — Ola F1 completada.</p>
    </div>
  `,
  styles: `
    .contenedor {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      text-align: center;
    }
  `,
})
export class LoginPlaceholderComponent {}
