import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Ruta } from '../../rutas/entities/ruta.entity';

@Entity('horarios')
export class Horario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ruta_id' })
  rutaId: string;

  @ManyToOne(() => Ruta)
  @JoinColumn({ name: 'ruta_id' })
  ruta: Ruta;

  // 'LMXJVSD' cada carácter representa un día activo de la semana
  @Column({ name: 'dias_semana', length: 20 })
  diasSemana: string;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin: string;

  // cada cuántos minutos sale un bus
  @Column({ name: 'frecuencia_min', default: 30 })
  frecuenciaMin: number;
}
