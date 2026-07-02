import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Log de requests HTTP (auditoría, paso 5): método, ruta, status y duración.
 * Complementa al HttpExceptionFilter (que loguea los 5xx con stack) dando
 * visibilidad del tráfico normal y de la latencia en producción.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const peticion = context.switchToHttp().getRequest();
    const inicio = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = context.switchToHttp().getResponse();
          this.logger.log(`${peticion.method} ${peticion.url} ${statusCode} +${Date.now() - inicio}ms`);
        },
        error: (err) => {
          const status = typeof err?.getStatus === 'function' ? err.getStatus() : 500;
          this.logger.warn(`${peticion.method} ${peticion.url} ${status} +${Date.now() - inicio}ms`);
        },
      }),
    );
  }
}
