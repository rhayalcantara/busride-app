import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { Pasajero } from './pasajero.entity';

@Entity('wallet_pasajeros')
export class WalletPasajero {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pasajero_id', unique: true })
  pasajeroId: string;

  @OneToOne(() => Pasajero)
  @JoinColumn({ name: 'pasajero_id' })
  pasajero: Pasajero;

  @Column({ name: 'saldo_viajes', default: 0 })
  saldoViajes: number;

  @Column({ name: 'saldo_dinero', type: 'decimal', precision: 10, scale: 2, default: 0 })
  saldoDinero: number;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;
}
