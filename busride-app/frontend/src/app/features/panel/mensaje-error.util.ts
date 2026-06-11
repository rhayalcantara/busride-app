import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extrae un mensaje legible de un error HTTP del backend NestJS.
 * Copia local del patrón de referencia (features/auth/mensaje-error.util.ts):
 * las áreas de la Ola F4 no comparten código entre sí.
 *
 * El backend responde `{ message: string | string[] }` (ValidationPipe
 * devuelve arreglo de mensajes; las excepciones de negocio — incluidos los
 * 409 de flota —, un string).
 */
export function extraerMensajeError(
  error: unknown,
  porDefecto = 'Ocurrió un error inesperado',
): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor';
    }
    const cuerpo = error.error as { message?: string | string[] } | null;
    const mensaje = cuerpo?.message;
    if (Array.isArray(mensaje) && mensaje.length > 0) {
      return mensaje.join(' · ');
    }
    if (typeof mensaje === 'string' && mensaje.trim() !== '') {
      return mensaje;
    }
  }
  return porDefecto;
}
