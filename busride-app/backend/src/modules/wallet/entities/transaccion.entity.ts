import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Pasajero } from './pasajero.entity';

export enum TipoTransaccion {
  RECARGA    = 'RECARGA',
  ABORDAJE   = 'ABORDAJE',
  DEVOLUCION = 'DEVOLUCION',
}

export enum EstadoTransaccion {
  PENDIENTE  = 'PENDIENTE',
  COMPLETADA = 'COMPLETADA',
}

@Entity('transacciones')
export class Transaccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pasajero_id' })
  pasajeroId: string;

  @ManyToOne(() => Pasajero)
  @JoinColumn({ name: 'pasajero_id' })
  pasajero: Pasajero;

  @Column({ length: 30 })
  tipo: TipoTransaccion;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  monto: number;

  @Column({ name: 'viajes_cantidad', default: 0 })
  viajesCantidad: number;

  // ID de la pasarela de pago externa
  @Column({ name: 'referencia_externa', length: 200, nullable: true })
  referenciaExterna: string;

  @Column({ length: 20, default: EstadoTransaccion.PENDIENTE })
  estado: EstadoTransaccion;

  @Column({ length: 300, nullable: true })
  descripcion: string;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
