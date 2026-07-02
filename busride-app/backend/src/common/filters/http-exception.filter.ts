import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro global de excepciones (auditoría, paso 5).
 *
 * - Para HttpException re-emite EXACTAMENTE el shape por defecto de Nest
 *   ({ statusCode, message, error }): los clientes (mensaje-error.util del
 *   frontend, e2e) dependen de ese formato — este filtro NO lo cambia.
 * - Para errores no controlados responde un 500 genérico sin filtrar detalles
 *   internos y loguea el stack completo, que antes se perdía.
 * - Loguea todo 5xx con método, ruta y stack para diagnóstico en producción.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Excepciones');

  catch(exception: unknown, host: ArgumentsHost) {
    // Solo HTTP: los gateways WS tienen su propio manejo (WsException)
    if (host.getType() !== 'http') throw exception;

    const contexto = host.switchToHttp();
    const respuesta = contexto.getResponse<Response>();
    const peticion = contexto.getRequest<Request>();

    const esHttpException = exception instanceof HttpException;
    const status = esHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${peticion.method} ${peticion.url} → ${status}`, stack);
    }

    if (esHttpException) {
      // Shape por defecto de Nest, sin tocar
      const cuerpo = exception.getResponse();
      respuesta.status(status).json(cuerpo);
      return;
    }

    // Error no controlado: respuesta genérica (sin stack ni mensajes internos)
    respuesta.status(status).json({
      statusCode: status,
      message: 'Error interno del servidor',
      error: 'Internal Server Error',
    });
  }
}
