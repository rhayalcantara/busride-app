import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('pasajeros')
export class Pasajero {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @OneToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'foto_url', length: 500, nullable: true })
  fotoUrl: string;

  @Column({ name: 'viajes_realizados', default: 0 })
  viajesRealizados: number;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
