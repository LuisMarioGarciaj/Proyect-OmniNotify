import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueuesModule } from '../../queues/queues.module';
import { NotificationsModule } from '../../notifications.module';
import { EmailController } from '../../controllers/email.controller';
import { NotificationsService } from '../../notifications.service';
import { ScheduledNotification } from '../../entities/scheduled-notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledNotification]),
    QueuesModule, // ✅ Importar módulo de colas
    NotificationsModule,
  ],
  controllers: [EmailController],
  providers: [NotificationsService],
  exports: [],
})
export class EmailModule {}