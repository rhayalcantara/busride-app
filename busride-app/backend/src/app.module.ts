import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { getDatabaseConfig } from './config/database.config';
import { validarEntorno } from './config/env.validation';
import { PasswordCaducadaGuard, RolesGuard, ThrottlerHttpGuard } from './common';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';

// Entidades
import { Rol }           from './modules/usuarios/entities/rol.entity';
import { Usuario }       from './modules/usuarios/entities/usuario.entity';
import { Asociacion }    from './modules/asociaciones/entities/asociacion.entity';
import { Conductor }     from './modules/conductores/entities/conductor.entity';
import { Calificacion }  from './modules/conductores/entities/calificacion.entity';
import { Pasajero }      from './modules/wallet/entities/pasajero.entity';
import { WalletPasajero } from './modules/wallet/entities/wallet.entity';
import { Transaccion }   from './modules/wallet/entities/transaccion.entity';
import { PaqueteViaje }  from './modules/wallet/entities/paquete-viaje.entity';
import { Ruta }          from './modules/rutas/entities/ruta.entity';
import { Parada }        from './modules/rutas/entities/parada.entity';
import { Viaje }         from './modules/buses/entities/viaje.entity';
import { Bus }           from './modules/buses/entities/bus.entity';
import { Horario }       from './modules/buses/entities/horario.entity';
import { AsignacionBusRuta } from './modules/buses/entities/asignacion-bus-ruta.entity';
import { Reserva }       from './modules/reservas/entities/reserva.entity';
import { Abordaje }      from './modules/reservas/entities/abordaje.entity';
import { Liquidacion }   from './modules/liquidaciones/entities/liquidacion.entity';
import { ConfigComision } from './modules/liquidaciones/entities/config-comision.entity';
import { TokenRefresco } from './modules/auth/entities/token-refresco.entity';

// Módulos de negocio
import { AuthModule }         from './modules/auth/auth.module';
import { UsuariosModule }     from './modules/usuarios/usuarios.module';
import { AsociacionesModule } from './modules/asociaciones/asociaciones.module';
import { ConductoresModule }  from './modules/conductores/conductores.module';
import { FlotaModule }        from './modules/flota/flota.module';
import { RutasModule }        from './modules/rutas/rutas.module';
import { ReservasModule }     from './modules/reservas/reservas.module';
import { ViajesModule }       from './modules/buses/viajes.module';
import { WalletModule }       from './modules/wallet/wallet.module';
import { LiquidacionModule }  from './modules/liquidaciones/liquidacion.module';

@Module({
  imports: [
    // validate: fail-fast al arrancar si faltan secretos o hay valores inválidos
    ConfigModule.forRoot({ isGlobal: true, validate: validarEntorno }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // Rate limiting (B3, Ola 6): configurable por env para poder subir el límite
    // en e2e (los tests disparan cientos de requests en segundos). Defaults:
    // 100 requests por 60 s por IP.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: parseInt(config.get<string>('THROTTLE_TTL_MS', '60000'), 10),
          limit: parseInt(config.get<string>('THROTTLE_LIMIT', '100'), 10),
        },
      ],
    }),

    // Habilita @Cron y demás schedulers (activa ReservasCronService → sp_expirar_reservas)
    ScheduleModule.forRoot(),

    TypeOrmModule.forFeature([
      Rol, Usuario, Asociacion, Conductor, Calificacion,
      Pasajero, WalletPasajero, Transaccion, PaqueteViaje,
      Ruta, Parada, Viaje, Reserva, Abordaje,
      Bus, Horario, AsignacionBusRuta,
      Liquidacion, ConfigComision,
      TokenRefresco,
    ]),

    AuthModule,
    UsuariosModule,
    AsociacionesModule,
    ConductoresModule,
    FlotaModule,
    RutasModule,
    ReservasModule,
    ViajesModule,
    WalletModule,
    LiquidacionModule,
  ],
  // GET /api/v1/salud — healthcheck público (Docker HEALTHCHECK / load balancers)
  controllers: [AppController],
  providers: [
    // Cadena de guards globales (T-12, ampliada en T-16/B3). El ORDEN de estos
    // providers determina el orden de ejecución:
    //   1. ThrottlerHttpGuard — rate limit por IP ANTES de autenticar (también
    //      protege login/registrar de fuerza bruta). En contextos no-HTTP devuelve
    //      true (los APP_GUARD también corren en gateways WS).
    //   2. JwtAuthGuard — exige Bearer token y puebla request.user, salvo que el handler
    //      declare @Public() (login/registrar/refresh) o el contexto no sea HTTP (ahí
    //      devuelve true y el tracking se protege con su propio WsJwtGuard por mensaje).
    //   3. RolesGuard — sin metadata @Roles(...) es un no-op; con ella compara contra
    //      request.user.rol, que ya existe gracias a (2).
    // Los @UseGuards(JwtAuthGuard) que quedan en controladores son redundantes e inocuos.
    { provide: APP_GUARD, useClass: ThrottlerHttpGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    //   2.5 PasswordCaducadaGuard — tras autenticar: si el token trae el claim
    //       dcp (credencial provisional, p. ej. admin seed) bloquea en producción
    //       todo salvo @PermitirPasswordCaducada() (cambiar-password, logout).
    { provide: APP_GUARD, useClass: PasswordCaducadaGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
