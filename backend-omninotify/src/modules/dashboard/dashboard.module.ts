import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { NotificationLog } from '../notifications/entities/notification-log.entity';
import { ScheduledNotification } from '../notifications/entities/scheduled-notification.entity';
import { Contact } from '../contacts/entities/contact.entity';
import { Template } from '../templates/entities/template.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationLog,
      ScheduledNotification,
      Contact,
      Template,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}