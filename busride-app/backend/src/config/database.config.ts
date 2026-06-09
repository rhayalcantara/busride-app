import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'mssql',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 1433),
  database: configService.get<string>('DB_NAME', 'busride_db'),
  username: configService.get<string>('DB_USER', 'sa'),
  password: configService.get<string>('DB_PASSWORD'),
  options: {
    encrypt: false,
    trustServerCertificate: true,
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
