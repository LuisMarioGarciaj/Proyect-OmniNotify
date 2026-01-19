import { Controller, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  async send(@Body() dto: SendNotificationDto) {
    // Orquesta la creación del log y el encolamiento
    return await this.notificationsService.enqueueNotification(dto);
  }
}