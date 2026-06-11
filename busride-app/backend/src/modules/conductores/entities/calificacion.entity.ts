import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Abordaje } from '../../reservas/entities/abordaje.entity';
import { Pasajero } from '../../wallet/entities/pasajero.entity';
import { Conductor } from './conductor.entity';

@Entity('calificaciones')
export class Calificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'abordaje_id', unique: true })
  abordajeId: string;

  @OneToOne(() => Abordaje)
  @JoinColumn({ name: 'abordaje_id' })
  abordaje: Abordaje;

  @Column({ name: 'pasajero_id' })
  pasajeroId: string;

  @ManyToOne(() => Pasajero)
  @JoinColumn({ name: 'pasajero_id' })
  pasajero: Pasajero;

  @Column({ name: 'conductor_id' })
  conductorId: string;

  @ManyToOne(() => Conductor)
  @JoinColumn({ name: 'conductor_id' })
  conductor: Conductor;

  // CHECK en BD: valor entre 1 y 5
  @Column({ type: 'tinyint' })
  estrellas: number;

  @Column({ length: 500, nullable: true })
  comentario: string;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
