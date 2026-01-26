import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Controladores
import { NotificationsController } from './notifications.controller';
import { EmailController } from './controllers/email.controller';

// Servicios
import { NotificationsService } from './notifications.service';

// ✅ ÚNICO processor que debe existir
import { EmailProcessor } from './processors/email.processor';

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
    BullModule.registerQueue({
      name: 'notification-queue',
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
      },
    }),
  ],
  controllers: [
    NotificationsController,
    EmailController,
  ],
  providers: [
    NotificationsService,
    EmailProcessor, // ✅ ESTE ES EL WORKER
    EmailProvider,
  ],
  exports: [
    NotificationsService,
    EmailProvider,
  ],
})
export class NotificationsModule {}
