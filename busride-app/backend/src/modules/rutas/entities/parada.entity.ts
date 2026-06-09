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

  // lat/lng almacenados por separado; la columna geography se maneja via raw SQL
  @Column({ type: 'float', nullable: true })
  lat: number;

  @Column({ type: 'float', nullable: true })
  lng: number;

  @Column({ length: 300, nullable: true })
  referencia: string;

  @Column({ name: 'es_terminal', default: false })
  esTerminal: boolean;
}
