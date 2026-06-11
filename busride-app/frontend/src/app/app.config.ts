import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AuthService, authInterceptor, refreshInterceptor } from './core/auth';
import { erroresInterceptor } from './core/interceptors/errores.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Orden OBLIGATORIO: auth (añade Bearer) → refresh (401 → rota token y
    // reintenta) → errores (snackbars globales 403/5xx/0).
    provideHttpClient(withInterceptors([authInterceptor, refreshInterceptor, erroresInterceptor])),
    // NOTA: NO se registra provideAnimationsAsync porque @angular/animations no
    // está instalado (F-01 no lo incluyó y F-05 no puede tocar package.json).
    // Angular Material 20 ya no lo necesita: sus componentes usan animaciones
    // CSS desde v19. Si una feature futura lo requiere, instalarlo en F-09.
    // Restaura la sesión (decodifica/refresca el token almacenado) ANTES del
    // primer ciclo de navegación: los guards ya ven el estado real.
    provideAppInitializer(() => inject(AuthService).cargarSesion()),
  ],
};
