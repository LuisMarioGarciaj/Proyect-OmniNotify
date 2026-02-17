////////////  SERVICIO SIN UNIFICACION

// // src/modules/notifications/notifications.module.ts
// import { Module } from '@nestjs/common';
// import { BullModule } from '@nestjs/bullmq';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { HttpModule } from '@nestjs/axios'; // ✅ NECESARIO para NexoWhatsappProvider

// // Controladores
// import { NotificationsController } from './notifications.controller';
// import { EmailController } from './controllers/email.controller';
// import { WhatsappController } from './controllers/whatsapp.controller'; 
// import { SmsController } from './controllers/sms.controller'; 

// // Servicios
// import { NotificationsService } from './notifications.service';
// import { TemplatesModule } from '../templates/templates.module';
// import { NotificationProcessor } from './processors/notification.processor';

// // Proveedores
// import { EmailProvider } from './providers/email.provider';
// import { WhatsappProvider } from './providers/whatsapp/whatsapp.provider'; // Twilio (futuro)
// import { NexoWhatsappProvider } from './providers/nexo-whatsapp.provider'; // ✅ NEXO (PRINCIPAL)
// import { SMSProvider } from './providers/sms/sms.provider';

// // Entidades
// import { CompanyProviderConfig } from '../providers/entities/company-provider-config.entity'; 
// import { Provider } from '../providers/entities/provider.entity';
// import { NotificationLog } from './entities/notification-log.entity';
// import { ScheduledNotification } from './entities/scheduled-notification.entity';
// import { Template } from '../templates/entities/template.entity';

// @Module({
//   imports: [
//     // ✅ ConfigModule para acceder a variables de entorno
//     ConfigModule,
    
//     // ✅ HttpModule NECESARIO para que NexoWhatsappProvider pueda hacer requests HTTP
//     HttpModule,
    
//     // ✅ TemplatesModule para acceder a plantillas
//     TemplatesModule, 
    
//     // ✅ Entidades de TypeORM
//     TypeOrmModule.forFeature([
//       NotificationLog,
//       ScheduledNotification,
//       Template,
//       CompanyProviderConfig,
//       Provider,
//     ]),

//     // ✅ BullMQ - Configuración de Redis y cola
//     BullModule.forRootAsync({
//       imports: [ConfigModule],
//       inject: [ConfigService],
//       useFactory: (configService: ConfigService) => ({
//         connection: {
//           host: configService.get<string>('REDIS_HOST', 'localhost'),
//           port: configService.get<number>('REDIS_PORT', 6379),
//           password: configService.get<string>('REDIS_PASSWORD', ''),
//           // ⚠️ TLS solo si es necesario (ej: Redis Cloud)
//           // tls: configService.get<boolean>('REDIS_TLS', false) 
//           //   ? { rejectUnauthorized: false } 
//           //   : undefined,
//         },
//         defaultJobOptions: {
//           attempts: configService.get<number>('QUEUE_ATTEMPTS', 3),
//           backoff: {
//             type: 'exponential',
//             delay: configService.get<number>('QUEUE_BACKOFF_DELAY', 2000),
//           },
//           removeOnComplete: 100,
//           removeOnFail: 500,
//         },
//       }),
//     }),

//     // ✅ Registrar cola 'notifications'
//     BullModule.registerQueue({
//       name: 'notifications',
//     }),
//   ],

//   controllers: [
//     NotificationsController,
//     EmailController,
//     WhatsappController, // ✅ Ya usa BullMQ
//     SmsController,
//   ],

//   providers: [
//     // ✅ Servicios principales
//     NotificationsService,
//     NotificationProcessor,  // ✅ PROCESADOR ÚNICO para Email, SMS y WhatsApp
    
//     // ✅ Proveedores de notificación
//     EmailProvider,
//     SMSProvider,
    
//     // ✅ Proveedores de WhatsApp
//     NexoWhatsappProvider,   // ✅ PRINCIPAL (activo)
//     WhatsappProvider,       // ⚠️ Twilio (opcional, para futuro cuando tengas documentos)
//   ],

//   exports: [
//     // ✅ Exportar servicios y providers para otros módulos
//     NotificationsService,
//     EmailProvider,
//     SMSProvider,
//     NexoWhatsappProvider,   // ✅ Por si otros módulos necesitan acceso directo
//     WhatsappProvider,
//   ],
// })
// export class NotificationsModule {}



// src/modules/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios'; // ✅ NECESARIO para NexoWhatsappProvider

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
import { NotificationUnifiedService } from './notification-unified.service'; // ✅ NUEVO servicio unificado
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

// ============================================
// MÓDULOS EXTERNOS
// ============================================
//import { SystemConfigModule } from '../system/system-config.controller';

@Module({
  imports: [
    // ✅ ConfigModule para acceder a variables de entorno
    ConfigModule,
    
    // ✅ HttpModule NECESARIO para que NexoWhatsappProvider pueda hacer requests HTTP
    HttpModule,
    
    // ✅ TemplatesModule para acceder a plantillas
    TemplatesModule, 
    
    // ✅ SystemConfigModule para acceder a SystemConfigService
    //SystemConfigModule,
    
    // ✅ Entidades de TypeORM - TODAS LAS QUE NECESITA EL PROCESSOR
    TypeOrmModule.forFeature([
      NotificationLog,
      ScheduledNotification,
      Template,
      CompanyProviderConfig,  // ✅ CRÍTICO - El processor lo necesita
      Provider,               // ✅ CRÍTICO - El processor lo necesita
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
    NotificationUnifiedService,  // ✅ NUEVO - exportar también
    EmailProvider,
    SMSProvider,
    NexoWhatsappProvider,
    WhatsappProvider,
  ],
})
export class NotificationsModule {}