import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueuesModule } from '../../queues/queues.module';
import { NotificationsModule } from '../../notifications.module';
import { WhatsappController } from '../../controllers/whatsapp.controller';
import { WhatsappProvider } from './whatsapp.provider';
import { NotificationsService } from '../../notifications.service';
import { ScheduledNotification } from '../../entities/scheduled-notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledNotification]),
    QueuesModule, // ✅ Importar módulo de colas
    NotificationsModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappProvider, NotificationsService],
  exports: [WhatsappProvider], // Exportar para uso en otros módulos
})
export class WhatsappModule {}