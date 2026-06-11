import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletPasajero } from './entities/wallet.entity';
import { Pasajero } from './entities/pasajero.entity';

describe('WalletService', () => {
  let service: WalletService;

  const walletRepo = {
    findOne: jest.fn(),
  };
  const pasajeroRepo = {
    findOne: jest.fn(),
  };

  // queryRunner mock: las queries SQL crudas se mockean por orden de llamada
  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
  };
  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
    query: jest.fn(),
  };

  const pasajero = { id: 'pasajero-1', usuarioId: 'usuario-1' };
  const dtoCompra = { paqueteId: 1, referenciaExterna: 'PAY-2026-0001-ABC' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: getRepositoryToken(WalletPasajero), useValue: walletRepo },
        { provide: getRepositoryToken(Pasajero), useValue: pasajeroRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  describe('obtenerMiSaldo', () => {
    it('lanza NotFoundException si el usuario no tiene perfil de pasajero', async () => {
      pasajeroRepo.findOne.mockResolvedValue(null);

      await expect(service.obtenerMiSaldo('usuario-sin-pasajero')).rejects.toThrow(
        NotFoundException,
      );
      expect(walletRepo.findOne).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el pasajero no tiene wallet', async () => {
      pasajeroRepo.findOne.mockResolvedValue(pasajero);
      walletRepo.findOne.mockResolvedValue(null);

      await expect(service.obtenerMiSaldo('usuario-1')).rejects.toThrow(NotFoundException);
    });

    it('devuelve la wallet del pasajero resuelto desde el JWT', async () => {
      const wallet = { id: 'wallet-1', pasajeroId: 'pasajero-1', saldoViajes: 5, saldoDinero: 0 };
      pasajeroRepo.findOne.mockResolvedValue(pasajero);
      walletRepo.findOne.mockResolvedValue(wallet);

      const resultado = await service.obtenerMiSaldo('usuario-1');

      expect(pasajeroRepo.findOne).toHaveBeenCalledWith({ where: { usuarioId: 'usuario-1' } });
      expect(walletRepo.findOne).toHaveBeenCalledWith({ where: { pasajeroId: 'pasajero-1' } });
      expect(resultado).toBe(wallet);
    });
  });

  describe('comprarPaquete', () => {
    beforeEach(() => {
      pasajeroRepo.findOne.mockResolvedValue(pasajero);
    });

    it('idempotencia: si ya existe transacción COMPLETADA con la referencia, devuelve idempotente=true sin acreditar', async () => {
      // 1ª query: SELECT de idempotencia encuentra la transacción original
      queryRunner.query.mockResolvedValueOnce([
        {
          id: 'tx-original',
          monto: 500,
          viajes_cantidad: 12,
          descripcion: 'Compra paquete: Básico',
          fecha_creacion: new Date('2026-06-01'),
        },
      ]);

      const resultado = await service.comprarPaquete('usuario-1', dtoCompra);

      expect(resultado.idempotente).toBe(true);
      expect(resultado.transaccionId).toBe('tx-original');
      expect(resultado.viajesAcreditados).toBe(12);

      // Solo se ejecutó el SELECT de idempotencia: ni INSERT ni UPDATE de acreditación
      expect(queryRunner.query).toHaveBeenCalledTimes(1);
      const sqlEjecutados = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqlEjecutados.some((sql) => sql.includes('INSERT'))).toBe(false);
      expect(sqlEjecutados.some((sql) => sql.includes('UPDATE wallet_pasajeros'))).toBe(false);

      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('lanza BadRequestException y hace rollback si el paquete no existe o está inactivo', async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // idempotencia: no hay transacción previa
        .mockResolvedValueOnce([]); // paquete no encontrado

      await expect(service.comprarPaquete('usuario-1', dtoCompra)).rejects.toThrow(
        BadRequestException,
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('compra OK: registra la transacción y acredita cantidad_viajes + viajes_bono', async () => {
      const paquete = {
        id: 1,
        nombre: 'Básico',
        precio: 500,
        cantidad_viajes: 10,
        viajes_bono: 2,
      };
      queryRunner.query
        .mockResolvedValueOnce([]) // idempotencia: sin transacción previa
        .mockResolvedValueOnce([paquete]) // paquete activo
        .mockResolvedValueOnce([{ id: 'tx-nueva' }]) // INSERT transacción
        .mockResolvedValueOnce([{ id: 'wallet-1' }]) // wallet existente
        .mockResolvedValueOnce([{ saldo_viajes: 17 }]); // UPDATE acreditación

      const resultado = await service.comprarPaquete('usuario-1', dtoCompra);

      expect(resultado).toEqual({
        idempotente: false,
        transaccionId: 'tx-nueva',
        paquete: 'Básico',
        precio: 500,
        viajesAcreditados: 12, // 10 + 2 de bono
        saldoViajes: 17,
      });

      // El INSERT de la transacción lleva el total (10+2) y la referencia externa
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transacciones'),
        expect.arrayContaining(['pasajero-1', 500, 12, 'PAY-2026-0001-ABC']),
      );
      // El UPDATE acredita 12 viajes al wallet del pasajero
      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE wallet_pasajeros'),
        [12, 'pasajero-1'],
      );
      // Wallet existía: no se intenta crear
      const sqlEjecutados = queryRunner.query.mock.calls.map((c) => c[0] as string);
      expect(sqlEjecutados.some((sql) => sql.includes('INSERT INTO wallet_pasajeros'))).toBe(false);

      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('si el pasajero no tiene wallet, la crea dentro de la transacción antes de acreditar', async () => {
      const paquete = { id: 1, nombre: 'Básico', precio: 500, cantidad_viajes: 10, viajes_bono: 0 };
      queryRunner.query
        .mockResolvedValueOnce([]) // idempotencia
        .mockResolvedValueOnce([paquete]) // paquete
        .mockResolvedValueOnce([{ id: 'tx-nueva' }]) // INSERT transacción
        .mockResolvedValueOnce([]) // wallet NO existe
        .mockResolvedValueOnce(undefined) // INSERT wallet
        .mockResolvedValueOnce([{ saldo_viajes: 10 }]); // UPDATE acreditación

      const resultado = await service.comprarPaquete('usuario-1', dtoCompra);

      expect(queryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO wallet_pasajeros'),
        ['pasajero-1'],
      );

      // La creación de la wallet ocurre ANTES del UPDATE de acreditación
      const sqlEjecutados = queryRunner.query.mock.calls.map((c) => c[0] as string);
      const idxInsertWallet = sqlEjecutados.findIndex((sql) =>
        sql.includes('INSERT INTO wallet_pasajeros'),
      );
      const idxUpdate = sqlEjecutados.findIndex((sql) => sql.includes('UPDATE wallet_pasajeros'));
      expect(idxInsertWallet).toBeGreaterThan(-1);
      expect(idxInsertWallet).toBeLessThan(idxUpdate);

      expect(resultado.saldoViajes).toBe(10);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    });

    it('lanza NotFoundException sin abrir transacción si el usuario no tiene perfil de pasajero', async () => {
      pasajeroRepo.findOne.mockResolvedValue(null);

      await expect(service.comprarPaquete('usuario-x', dtoCompra)).rejects.toThrow(
        NotFoundException,
      );
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });
  });

  describe('historialTransacciones', () => {
    it('usa el límite recibido del DTO en el TOP de la query', async () => {
      pasajeroRepo.findOne.mockResolvedValue(pasajero);
      dataSource.query.mockResolvedValue([{ id: 'tx-1' }]);

      const resultado = await service.historialTransacciones('usuario-1', 50);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT TOP (@0)'),
        [50, 'pasajero-1'],
      );
      expect(resultado).toEqual([{ id: 'tx-1' }]);
    });

    it('aplica el límite por defecto (20) cuando no se especifica', async () => {
      pasajeroRepo.findOne.mockResolvedValue(pasajero);
      dataSource.query.mockResolvedValue([]);

      await service.historialTransacciones('usuario-1');

      expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [20, 'pasajero-1']);
    });

    it('lanza NotFoundException si no hay perfil de pasajero', async () => {
      pasajeroRepo.findOne.mockResolvedValue(null);

      await expect(service.historialTransacciones('usuario-x', 10)).rejects.toThrow(
        NotFoundException,
      );
      expect(dataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('listarPaquetes', () => {
    it('consulta solo paquetes activos ordenados por cantidad de viajes', async () => {
      dataSource.query.mockResolvedValue([{ id: 1, nombre: 'Básico' }]);

      const resultado = await service.listarPaquetes();

      expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('activo = 1'));
      expect(resultado).toEqual([{ id: 1, nombre: 'Básico' }]);
    });
  });
});
