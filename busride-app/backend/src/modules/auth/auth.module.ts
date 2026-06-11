import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Pasajero } from '../wallet/entities/pasajero.entity';
import { WalletPasajero } from '../wallet/entities/wallet.entity';
import { TokenRefresco } from './entities/token-refresco.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    TypeOrmModule.forFeature([Usuario, Rol, Pasajero, WalletPasajero, TokenRefresco]),
    // Registro ÚNICO y global del JwtModule (T-12): JwtService queda disponible en
    // toda la app (reservas firma/verifica QR, viajes lo usa para el WsJwtGuard del
    // tracking) sin duplicar registerAsync en cada módulo.
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '24h') },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
