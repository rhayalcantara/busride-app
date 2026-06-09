import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('asociaciones')
export class Asociacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @OneToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ length: 200 })
  nombre: string;

  @Column({ length: 20, nullable: true, unique: true })
  rnc: string;

  @Column({ length: 300, nullable: true })
  direccion: string;

  @Column({ length: 20, nullable: true })
  telefono: string;

  @Column({ name: 'logo_url', length: 500, nullable: true })
  logoUrl: string;

  @Column({ length: 20, default: 'PENDIENTE' })
  estado: string;

  @Column({ name: 'comision_pct', type: 'decimal', precision: 5, scale: 2, default: 15.00 })
  comisionPct: number;

  @Column({ name: 'fecha_aprobacion', type: 'datetime2', nullable: true })
  fechaAprobacion: Date;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
