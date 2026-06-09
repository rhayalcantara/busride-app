import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Asociacion } from '../../asociaciones/entities/asociacion.entity';

@Entity('conductores')
export class Conductor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @OneToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'asociacion_id' })
  asociacionId: string;

  @ManyToOne(() => Asociacion)
  @JoinColumn({ name: 'asociacion_id' })
  asociacion: Asociacion;

  @Column({ name: 'licencia_numero', length: 50, unique: true })
  licenciaNumero: string;

  @Column({ name: 'licencia_vence', type: 'date' })
  licenciaVence: Date;

  @Column({ name: 'foto_url', length: 500, nullable: true })
  fotoUrl: string;

  @Column({ name: 'calificacion_promedio', type: 'decimal', precision: 3, scale: 2, default: 0 })
  calificacionPromedio: number;

  @Column({ name: 'total_viajes', default: 0 })
  totalViajes: number;

  @Column({ name: 'cuenta_bancaria', length: 30, nullable: true })
  cuentaBancaria: string;

  @Column({ length: 100, nullable: true })
  banco: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
