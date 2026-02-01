// src/modules/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Controladores
import { EmailController } from './controllers/email.controller';

// Servicios
import { NotificationsService } from './notifications.service';

// Processors
import { NotificationProcessor } from './processors/notification.processor';

// Proveedores
import { EmailProvider } from './providers/email.provider';

// Entidades
import { NotificationLog } from './entities/notification-log.entity';
import { ScheduledNotification } from './entities/scheduled-notification.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      NotificationLog,
      ScheduledNotification,
    ]),
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
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [
    EmailController,
  ],
  providers: [
    NotificationsService,
    NotificationProcessor,
    EmailProvider,
  ],
  exports: [
    NotificationsService,
    EmailProvider,
  ],
})
export class NotificationsModule {}