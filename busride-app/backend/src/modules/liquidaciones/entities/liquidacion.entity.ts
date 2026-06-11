import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Conductor } from '../../conductores/entities/conductor.entity';
import { Viaje } from '../../buses/entities/viaje.entity';

export enum EstadoLiquidacion {
  PENDIENTE  = 'PENDIENTE',
  PAGADA     = 'PAGADA',
  EN_PROCESO = 'EN_PROCESO',
}

@Entity('liquidaciones')
export class Liquidacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conductor_id' })
  conductorId: string;

  @ManyToOne(() => Conductor)
  @JoinColumn({ name: 'conductor_id' })
  conductor: Conductor;

  @Column({ name: 'viaje_id', nullable: true })
  viajeId: string;

  @ManyToOne(() => Viaje)
  @JoinColumn({ name: 'viaje_id' })
  viaje: Viaje;

  @Column({ name: 'periodo_inicio', type: 'date' })
  periodoInicio: Date;

  @Column({ name: 'periodo_fin', type: 'date' })
  periodoFin: Date;

  @Column({ name: 'total_abordajes', default: 0 })
  totalAbordajes: number;

  @Column({ name: 'ingreso_bruto', type: 'decimal', precision: 10, scale: 2, default: 0 })
  ingresoBruto: number;

  @Column({ name: 'comision_plataforma', type: 'decimal', precision: 10, scale: 2, default: 0 })
  comisionPlataforma: number;

  @Column({ name: 'comision_asociacion', type: 'decimal', precision: 10, scale: 2, default: 0 })
  comisionAsociacion: number;

  @Column({ name: 'monto_neto', type: 'decimal', precision: 10, scale: 2, default: 0 })
  montoNeto: number;

  @Column({ length: 20, default: EstadoLiquidacion.PENDIENTE })
  estado: EstadoLiquidacion;

  @Column({ name: 'referencia_pago', length: 200, nullable: true })
  referenciaPago: string;

  @Column({ name: 'fecha_pago', type: 'datetime2', nullable: true })
  fechaPago: Date;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
