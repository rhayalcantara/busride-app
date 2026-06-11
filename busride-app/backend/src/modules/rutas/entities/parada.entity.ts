import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Ruta } from './ruta.entity';

@Entity('paradas')
export class Parada {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ruta_id' })
  rutaId: string;

  @ManyToOne(() => Ruta, ruta => ruta.paradas)
  @JoinColumn({ name: 'ruta_id' })
  ruta: Ruta;

  @Column({ length: 200 })
  nombre: string;

  @Column()
  orden: number;

  // Bug de integración corregido en T-12: la tabla paradas NO tiene columnas
  // lat/lng — solo `ubicacion geography` (se escribe/lee con SQL crudo, ver
  // RutasService). Propiedades de transporte, NO persistidas.
  lat?: number;

  lng?: number;

  @Column({ length: 300, nullable: true })
  referencia: string;

  @Column({ name: 'es_terminal', default: false })
  esTerminal: boolean;
}
