// src/modules/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

// Controladores y Servicios existentes...
import { NotificationsController } from './notifications.controller';
import { EmailController } from './controllers/email.controller';
import { WhatsappController } from './controllers/whatsapp.controller'; 
import { NotificationsService } from './notifications.service';
import { TemplatesModule } from '../templates/templates.module';
import { NotificationProcessor } from './processors/notification.processor';

// Proveedores
import { EmailProvider } from './providers/email.provider';
import { WhatsappProvider } from './providers/whatsapp/whatsapp.provider'; 
import { NexoWhatsappProvider } from './providers/nexo-whatsapp.provider';

// Entidades (Asegúrate de que las rutas sean correctas)
import { CompanyProviderConfig } from '../providers/entities/company-provider-config.entity'; 
import { Provider } from '../providers/entities/provider.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { ScheduledNotification } from './entities/scheduled-notification.entity';
import { Template } from '../templates/entities/template.entity';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    TemplatesModule, 
    TypeOrmModule.forFeature([
      NotificationLog,
      ScheduledNotification,
      Template,
      CompanyProviderConfig, // ✨ MOVIDO AQUÍ
      Provider,              // ✨ MOVIDO AQUÍ
    ]),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD', ''),
        },
      }),
    }),

    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [
    NotificationsController,
    EmailController,
    WhatsappController,
  ],
  providers: [
    NotificationsService,
    NotificationProcessor,
    EmailProvider,
    WhatsappProvider,
    NexoWhatsappProvider,
  ],
  exports: [
    NotificationsService,
    EmailProvider,
    WhatsappProvider,
    NexoWhatsappProvider,
  ],
})
export class NotificationsModule {}