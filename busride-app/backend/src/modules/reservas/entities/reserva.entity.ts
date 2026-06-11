import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Pasajero } from '../../wallet/entities/pasajero.entity';
import { Viaje } from '../../buses/entities/viaje.entity';
import { Parada } from '../../rutas/entities/parada.entity';

export enum EstadoReserva {
  PROVISIONAL = 'PROVISIONAL',
  CONFIRMADA  = 'CONFIRMADA',
  ABORDADA    = 'ABORDADA',
  EXPIRADA    = 'EXPIRADA',
  CANCELADA   = 'CANCELADA',
}

@Entity('reservas')
export class Reserva {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pasajero_id' })
  pasajeroId: string;

  @ManyToOne(() => Pasajero)
  @JoinColumn({ name: 'pasajero_id' })
  pasajero: Pasajero;

  @Column({ name: 'viaje_id' })
  viajeId: string;

  @ManyToOne(() => Viaje)
  @JoinColumn({ name: 'viaje_id' })
  viaje: Viaje;

  @Column({ name: 'parada_origen_id' })
  paradaOrigenId: number;

  @ManyToOne(() => Parada)
  @JoinColumn({ name: 'parada_origen_id' })
  paradaOrigen: Parada;

  @Column({ name: 'parada_destino_id' })
  paradaDestinoId: number;

  @ManyToOne(() => Parada)
  @JoinColumn({ name: 'parada_destino_id' })
  paradaDestino: Parada;

  @Column({ length: 20, default: EstadoReserva.PROVISIONAL })
  estado: EstadoReserva;

  @Column({ name: 'qr_token', length: 500, unique: true })
  qrToken: string;

  @Column({ name: 'qr_expira_en', type: 'datetime2' })
  qrExpiraEn: Date;

  @Column({ name: 'numero_asiento', nullable: true })
  numeroAsiento: number;

  // Bug de integración corregido en T-12: la tabla reservas NO tiene columnas
  // lat_pasajero/lng_pasajero — solo `ubicacion_pasajero geography`, que escribe
  // sp_crear_reserva. Propiedades de transporte, NO persistidas.
  latPasajero?: number;

  lngPasajero?: number;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @Column({ name: 'fecha_abordaje', type: 'datetime2', nullable: true })
  fechaAbordaje: Date;
}
