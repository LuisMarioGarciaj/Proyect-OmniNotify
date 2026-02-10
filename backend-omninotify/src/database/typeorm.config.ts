import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: 'caboose.proxy.rlwy.net', // DIRECTO
  port: 57302, // DIRECTO
  username: 'root', // DIRECTO
  password: 'gPVrdjMLKAUJfqRJkwnBUltdYpnqTkhX', // DIRECTO
  database: 'omninotify', // DIRECTO
  
  entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  synchronize: false,
  logging: true,
  
  // Configuración para MySQL remoto
  extra: {
    ssl: {
      rejectUnauthorized: false, // Para Railway/Cloud
    },
  },
};