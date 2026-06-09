import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { getDatabaseConfig } from './config/database.config';

// Entidades
import { Rol }           from './modules/usuarios/entities/rol.entity';
import { Usuario }       from './modules/usuarios/entities/usuario.entity';
import { Asociacion }    from './modules/asociaciones/entities/asociacion.entity';
import { Conductor }     from './modules/conductores/entities/conductor.entity';
import { Pasajero }      from './modules/wallet/entities/pasajero.entity';
import { WalletPasajero } from './modules/wallet/entities/wallet.entity';
import { Ruta }          from './modules/rutas/entities/ruta.entity';
import { Parada }        from './modules/rutas/entities/parada.entity';
import { Viaje }         from './modules/buses/entities/viaje.entity';
import { Reserva }       from './modules/reservas/entities/reserva.entity';

// Módulos de negocio
import { AuthModule }        from './modules/auth/auth.module';
import { RutasModule }       from './modules/rutas/rutas.module';
import { ReservasModule }    from './modules/reservas/reservas.module';
import { ViajesModule }      from './modules/buses/viajes.module';
import { WalletModule }      from './modules/wallet/wallet.module';
import { LiquidacionModule } from './modules/liquidaciones/liquidacion.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // Rate limiting: 100 requests per 60 segundos
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    TypeOrmModule.forFeature([
      Rol, Usuario, Asociacion, Conductor,
      Pasajero, WalletPasajero,
      Ruta, Parada, Viaje, Reserva,
    ]),

    AuthModule,
    RutasModule,
    ReservasModule,
    ViajesModule,
    WalletModule,
    LiquidacionModule,
  ],
})
export class AppModule {}
