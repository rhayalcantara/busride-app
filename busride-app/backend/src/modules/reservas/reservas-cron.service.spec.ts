import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ReservasCronService } from './reservas-cron.service';

describe('ReservasCronService', () => {
  let service: ReservasCronService;

  const dataSourceMock = { query: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Silenciar el logger del cron para no ensuciar la salida de jest
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservasCronService,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = moduleRef.get(ReservasCronService);
  });

  describe('expirarReservas', () => {
    it('ejecuta sp_expirar_reservas', async () => {
      // Arrange
      dataSourceMock.query.mockResolvedValueOnce([{ reservas_expiradas: 3 }]);

      // Act
      await service.expirarReservas();

      // Assert
      expect(dataSourceMock.query).toHaveBeenCalledWith(
        expect.stringContaining('EXEC sp_expirar_reservas'),
      );
    });

    it('no propaga errores del SP (el cron debe seguir vivo)', async () => {
      // Arrange
      dataSourceMock.query.mockRejectedValueOnce(new Error('BD caída'));

      // Act + Assert: el error se captura y registra, nunca revienta el scheduler
      await expect(service.expirarReservas()).resolves.toBeUndefined();
    });
  });
});
