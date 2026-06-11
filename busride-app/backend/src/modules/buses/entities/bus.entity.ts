import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Asociacion } from '../../asociaciones/entities/asociacion.entity';

@Entity('buses')
export class Bus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'asociacion_id' })
  asociacionId: string;

  @ManyToOne(() => Asociacion)
  @JoinColumn({ name: 'asociacion_id' })
  asociacion: Asociacion;

  @Column({ length: 20, unique: true })
  placa: string;

  @Column({ length: 100, nullable: true })
  modelo: string;

  @Column({ length: 100, nullable: true })
  marca: string;

  @Column({ nullable: true })
  anno: number;

  @Column({ name: 'capacidad_total' })
  capacidadTotal: number;

  @Column({ name: 'foto_url', length: 500, nullable: true })
  fotoUrl: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
