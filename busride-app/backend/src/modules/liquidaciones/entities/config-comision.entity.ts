import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('config_comisiones')
export class ConfigComision {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ name: 'pct_plataforma', type: 'decimal', precision: 5, scale: 2, default: 10.00 })
  pctPlataforma: number;

  @Column({ name: 'pct_asociacion', type: 'decimal', precision: 5, scale: 2, default: 5.00 })
  pctAsociacion: number;

  @Column({ default: true })
  activo: boolean;

  @Column({ name: 'fecha_desde', type: 'date' })
  fechaDesde: Date;

  @Column({ name: 'fecha_hasta', type: 'date', nullable: true })
  fechaHasta: Date;
}
