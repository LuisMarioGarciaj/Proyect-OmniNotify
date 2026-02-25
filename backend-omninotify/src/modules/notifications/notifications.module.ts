// src/modules/notifications/notifications.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios'; // ✅ NECESARIO para NexoWhatsappProvider

// ============================================
// MÓDULOS NECESARIOS
// ============================================
import { CreditsModule } from '../credits/credits.module'; // 🔥 NUEVO: Importar módulo de créditos
import { CompaniesModule } from '../companies/companies.module'; // 🔥 NUEVO: Para acceder a Company entity

// ============================================
// CONTROLADORES
// ============================================
import { NotificationsController } from './notifications.controller';
import { EmailController } from './controllers/email.controller';
import { WhatsappController } from './controllers/whatsapp.controller'; 
import { SmsController } from './controllers/sms.controller'; 

// ============================================
// SERVICIOS
// ============================================
import { NotificationsService } from './notifications.service';
import { NotificationUnifiedService } from './notification-unified.service';
import { TemplatesModule } from '../templates/templates.module';
import { NotificationProcessor } from './processors/notification.processor';

// ============================================
// PROVEEDORES
// ============================================
import { EmailProvider } from './providers/email.provider';
import { WhatsappProvider } from './providers/whatsapp/whatsapp.provider';
import { NexoWhatsappProvider } from './providers/nexo-whatsapp.provider';
import { SMSProvider } from './providers/sms/sms.provider';

// ============================================
// ENTIDADES
// ============================================
import { CompanyProviderConfig } from '../providers/entities/company-provider-config.entity'; 
import { Provider } from '../providers/entities/provider.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { ScheduledNotification } from './entities/scheduled-notification.entity';
import { Template } from '../templates/entities/template.entity';
import { Company } from '../companies/entities/company.entity'; // 🔥 NUEVO: Para transacciones

@Module({
  imports: [
    // ✅ ConfigModule para acceder a variables de entorno
    ConfigModule,
    
    // ✅ HttpModule NECESARIO para que NexoWhatsappProvider pueda hacer requests HTTP
    HttpModule,
    
    // ✅ TemplatesModule para acceder a plantillas
    TemplatesModule, 
    
    // 🔥 NUEVO: Importar módulo de créditos (con forwardRef para evitar dependencias circulares)
    forwardRef(() => CreditsModule),
    
    // 🔥 NUEVO: Importar módulo de empresas para Company entity
    forwardRef(() => CompaniesModule),
    
    // ✅ Entidades de TypeORM - TODAS LAS QUE NECESITA EL PROCESSOR
    TypeOrmModule.forFeature([
      NotificationLog,
      ScheduledNotification,
      Template,
      CompanyProviderConfig,  // ✅ CRÍTICO - El processor lo necesita
      Provider,               // ✅ CRÍTICO - El processor lo necesita
      Company,                // 🔥 NUEVO - Para transacciones de créditos
    ]),

    // ✅ BullMQ - Configuración de Redis y cola
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD', ''),
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

    // ✅ Registrar cola 'notifications'
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],

  controllers: [
    NotificationsController,  // ✅ Controlador unificado NUEVO
    EmailController,          // ✅ Mantener legacy
    WhatsappController,       // ✅ Mantener legacy
    SmsController,            // ✅ Mantener legacy
  ],

  providers: [
    // ✅ Servicios principales
    NotificationsService,         // ✅ Servicio original (mantener por compatibilidad)
    NotificationUnifiedService,   // ✅ Servicio NUEVO unificado
    NotificationProcessor,        // ✅ PROCESADOR ÚNICO para Email, SMS y WhatsApp
    
    // ✅ Proveedores de notificación
    EmailProvider,
    SMSProvider,
    
    // ✅ Proveedores de WhatsApp
    NexoWhatsappProvider,   // ✅ PRINCIPAL (activo)
    WhatsappProvider,       // ⚠️ Twilio (opcional, para futuro)
  ],

  exports: [
    // ✅ Exportar servicios y providers para otros módulos
    NotificationsService,
    NotificationUnifiedService,
    EmailProvider,
    SMSProvider,
    NexoWhatsappProvider,
    WhatsappProvider,
    NotificationProcessor, // 🔥 NUEVO: Exportar para que CreditsModule pueda usarlo si es necesario
  ],
})
export class NotificationsModule {}