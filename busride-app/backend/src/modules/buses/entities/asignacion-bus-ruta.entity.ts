import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Ruta } from '../../rutas/entities/ruta.entity';
import { Conductor } from '../../conductores/entities/conductor.entity';
import { Bus } from './bus.entity';

@Entity('asignaciones_bus_ruta')
export class AsignacionBusRuta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ruta_id' })
  rutaId: string;

  @ManyToOne(() => Ruta)
  @JoinColumn({ name: 'ruta_id' })
  ruta: Ruta;

  @Column({ name: 'bus_id' })
  busId: string;

  @ManyToOne(() => Bus)
  @JoinColumn({ name: 'bus_id' })
  bus: Bus;

  @Column({ name: 'conductor_id' })
  conductorId: string;

  @ManyToOne(() => Conductor)
  @JoinColumn({ name: 'conductor_id' })
  conductor: Conductor;

  @Column({ default: true })
  activa: boolean;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: Date;
}
