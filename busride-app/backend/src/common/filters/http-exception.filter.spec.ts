import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filtro = new HttpExceptionFilter();

  const crearHost = (tipo = 'http') => {
    const respuesta = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      getType: () => tipo,
      switchToHttp: () => ({
        getResponse: () => respuesta,
        getRequest: () => ({ method: 'GET', url: '/api/v1/prueba' }),
      }),
    } as unknown as ArgumentsHost;
    return { host, respuesta };
  };

  it('re-emite las HttpException con el shape por defecto de Nest, sin tocarlo', () => {
    const { host, respuesta } = crearHost();

    filtro.catch(new BadRequestException('El rol indicado no existe'), host);

    expect(respuesta.status).toHaveBeenCalledWith(400);
    // El cuerpo es EXACTAMENTE exception.getResponse(): los clientes dependen de él
    expect(respuesta.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'El rol indicado no existe',
      error: 'Bad Request',
    });
  });

  it('mantiene el shape también para otras HttpException (404)', () => {
    const { host, respuesta } = crearHost();

    filtro.catch(new NotFoundException(), host);

    expect(respuesta.status).toHaveBeenCalledWith(404);
    expect(respuesta.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    );
  });

  it('convierte errores no controlados en un 500 genérico sin detalles internos', () => {
    const { host, respuesta } = crearHost();

    filtro.catch(new Error('secreto interno: conexión a 10.0.0.5 falló'), host);

    expect(respuesta.status).toHaveBeenCalledWith(500);
    const cuerpo = (respuesta.json as jest.Mock).mock.calls[0][0];
    expect(cuerpo).toEqual({
      statusCode: 500,
      message: 'Error interno del servidor',
      error: 'Internal Server Error',
    });
    expect(JSON.stringify(cuerpo)).not.toContain('10.0.0.5');
  });

  it('re-lanza en contextos no-HTTP (los gateways WS tienen su propio manejo)', () => {
    const { host } = crearHost('ws');
    const error = new Error('ws');

    expect(() => filtro.catch(error, host)).toThrow(error);
  });
});
