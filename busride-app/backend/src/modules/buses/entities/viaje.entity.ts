import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Conductor } from '../../conductores/entities/conductor.entity';
import { Ruta } from '../../rutas/entities/ruta.entity';

export enum EstadoViaje {
  PROGRAMADO  = 'PROGRAMADO',
  EN_CURSO    = 'EN_CURSO',
  FINALIZADO  = 'FINALIZADO',
  CANCELADO   = 'CANCELADO',
}

@Entity('viajes')
export class Viaje {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conductor_id' })
  conductorId: string;

  @ManyToOne(() => Conductor)
  @JoinColumn({ name: 'conductor_id' })
  conductor: Conductor;

  @Column({ name: 'ruta_id' })
  rutaId: string;

  @ManyToOne(() => Ruta)
  @JoinColumn({ name: 'ruta_id' })
  ruta: Ruta;

  @Column({ name: 'bus_id' })
  busId: string;

  @Column({ name: 'asignacion_id' })
  asignacionId: string;

  @Column({ length: 20, default: EstadoViaje.PROGRAMADO })
  estado: EstadoViaje;

  @Column({ name: 'asientos_disponibles' })
  asientosDisponibles: number;

  @Column({ name: 'fecha_inicio', type: 'datetime2', nullable: true })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'datetime2', nullable: true })
  fechaFin: Date;

  // Posición actual: lat/lng actualizados via raw SQL para geography
  @Column({ name: 'pos_lat', type: 'float', nullable: true })
  posLat: number;

  @Column({ name: 'pos_lng', type: 'float', nullable: true })
  posLng: number;

  @Column({ name: 'fecha_posicion', type: 'datetime2', nullable: true })
  fechaPosicion: Date;

  @Column({ name: 'ingreso_total', type: 'decimal', precision: 10, scale: 2, default: 0 })
  ingresoTotal: number;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
