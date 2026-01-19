import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationProcessor } from './processors/notification.processor';
import { NotificationLog } from './entities/notification-log.entity';
import { ScheduledNotification } from './entities/scheduled-notification.entity';
//import { EmailProvider } from './providers/email/sendgrid.provider';
//import { SmsProvider } from './providers/sms/twilio.provider';
//import { WhatsappProvider } from './providers/whatsapp/wati.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationLog, ScheduledNotification]),
    BullModule.registerQueue({
      name: 'notification-queue', // Nombre de la cola [cite: 264]
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationProcessor,
    //EmailProvider,
    //SmsProvider,
    //WhatsappProvider,
  ],
})
export class NotificationsModule {}