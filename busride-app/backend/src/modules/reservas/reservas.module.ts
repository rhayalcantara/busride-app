import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Reserva } from './entities/reserva.entity';
import { ReservasService } from './reservas.service';
import { ReservasController } from './reservas.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reserva]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '24h') },
      }),
    }),
  ],
  providers: [ReservasService],
  controllers: [ReservasController],
  exports: [ReservasService],
})
export class ReservasModule {}
