import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD', ''),
          tls: configService.get<boolean>('REDIS_TLS', false) 
            ? { rejectUnauthorized: false } 
            : undefined,
        },
        defaultJobOptions: {
          attempts: configService.get<number>('QUEUE_ATTEMPTS', 3),
          backoff: {
            type: 'exponential',
            delay: configService.get<number>('QUEUE_BACKOFF_DELAY', 2000),
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    BullModule.registerQueue({
      name: 'emails',
    }),
  ],
  providers: [], // No necesitas providers aquí
  exports: [BullModule],
})
export class QueuesModule {}