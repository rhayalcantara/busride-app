import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'mssql',
  host: configService.get<string>('DB_HOST', 'localhost'),
  // tedious exige number; ConfigService devuelve string desde .env
  port: parseInt(configService.get<string>('DB_PORT', '1433'), 10),
  database: configService.get<string>('DB_NAME', 'busride_db'),
  username: configService.get<string>('DB_USER', 'busride_app'),
  password: configService.get<string>('DB_PASSWORD'),
  options: {
    // Configurable (auditoría, paso 5): false/true por defecto sirve para la red
    // interna de Docker; con una BD externa usar DB_ENCRYPT=true y
    // DB_TRUST_SERVER_CERTIFICATE=false (certificado válido).
    encrypt: configService.get<string>('DB_ENCRYPT', 'false') === 'true',
    trustServerCertificate:
      configService.get<string>('DB_TRUST_SERVER_CERTIFICATE', 'true') === 'true',
    enableArithAbort: true,
  },
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: configService.get<string>('NODE_ENV') === 'development',
  extra: {
    connectionTimeout: 30000,
    requestTimeout: 30000,
  },
});
