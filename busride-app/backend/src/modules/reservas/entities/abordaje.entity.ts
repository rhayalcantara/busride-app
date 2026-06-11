import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Reserva } from './reserva.entity';
import { Pasajero } from '../../wallet/entities/pasajero.entity';
import { Viaje } from '../../buses/entities/viaje.entity';
import { Conductor } from '../../conductores/entities/conductor.entity';

export enum TipoPago {
  SALDO_VIAJES = 'SALDO_VIAJES',
  SALDO_DINERO = 'SALDO_DINERO',
}

@Entity('abordajes')
export class Abordaje {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reserva_id' })
  reservaId: string;

  @ManyToOne(() => Reserva)
  @JoinColumn({ name: 'reserva_id' })
  reserva: Reserva;

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

  @Column({ name: 'conductor_id' })
  conductorId: string;

  @ManyToOne(() => Conductor)
  @JoinColumn({ name: 'conductor_id' })
  conductor: Conductor;

  @Column({ name: 'numero_asiento' })
  numeroAsiento: number;

  @Column({ name: 'monto_cobrado', type: 'decimal', precision: 10, scale: 2 })
  montoCobrado: number;

  @Column({ name: 'tipo_pago', length: 20 })
  tipoPago: TipoPago;

  @Column({ name: 'ticket_codigo', length: 50, unique: true })
  ticketCodigo: string;

  @CreateDateColumn({ name: 'fecha_abordaje' })
  fechaAbordaje: Date;
}
