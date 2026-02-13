import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        type: 'mysql',

        host: config.get<string>('DB_HOST'),
        port: Number(config.get<number>('DB_PORT')),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),

        autoLoadEntities: true,
        synchronize: false,
        logging: true,

        extra:
          config.get('DB_SSL') === 'true'
            ? { ssl: { rejectUnauthorized: false } }
            : {},
      }),
    }),
  ],
})
export class DatabaseModule {}
