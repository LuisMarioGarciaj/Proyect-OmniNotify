import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog, NotificationStatus } from './entities/notification-log.entity';
import { SendNotificationDto } from './dto/send-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notification-queue') private readonly notificationQueue: Queue,
    @InjectRepository(NotificationLog) private readonly logRepo: Repository<NotificationLog>,
  ) {}

  // notifications.service.ts
async enqueueNotification(dto: SendNotificationDto) {
  // 1. Crea el log forzando el tipo para evitar el error 'never'
  const logData = {
    company_id: dto.companyId,
    channel: dto.channel,
    recipient: dto.recipient,
    status: NotificationStatus.PENDING,
  } as any; // Usamos 'as any' temporalmente para saltar el conflicto de Enums

  const savedLog = await this.logRepo.save(logData);

  // 2. Encolar en BullMQ
  const job = await this.notificationQueue.add(
    'send-message',
    { ...dto, logId: savedLog.id }, // PASAMOS SOLO EL ID (String)
    { 
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 } 
    }
  );

  return { jobId: job.id, logId: savedLog.id };
}
}