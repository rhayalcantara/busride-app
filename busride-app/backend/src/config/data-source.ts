import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || 'busride_db',
  username: process.env.DB_USER || 'busride_app',
  password: process.env.DB_PASSWORD,
  options: {
    // Mantener en sincronía con database.config.ts (auditoría, paso 5)
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: (process.env.DB_TRUST_SERVER_CERTIFICATE ?? 'true') === 'true',
    enableArithAbort: true,
  },
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
