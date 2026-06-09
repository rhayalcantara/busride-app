import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { Asociacion } from '../../asociaciones/entities/asociacion.entity';
import { Parada } from './parada.entity';

@Entity('rutas')
export class Ruta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'asociacion_id' })
  asociacionId: string;

  @ManyToOne(() => Asociacion)
  @JoinColumn({ name: 'asociacion_id' })
  asociacion: Asociacion;

  @Column({ length: 200 })
  nombre: string;

  @Column({ length: 20, nullable: true })
  codigo: string;

  @Column({ length: 500, nullable: true })
  descripcion: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  tarifa: number;

  @Column({ default: true })
  activa: boolean;

  // polyline almacenada como WKT, convertida a geography en SQL Server
  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  polylineWkt: string;

  @OneToMany(() => Parada, parada => parada.ruta, { cascade: true })
  paradas: Parada[];

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
