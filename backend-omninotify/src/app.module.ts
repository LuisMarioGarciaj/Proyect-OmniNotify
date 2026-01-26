import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { TagsModule } from './modules/tags/tags.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TemplatesModule } from './modules/templates/templates.module'; // ¡AGREGA ESTO!

@Module({
  imports: [
    // ConfigModule DEBE ser primero
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Configuración de BullMQ/Redis
    BullModule.forRoot({
      connection: {
        host: 'localhost',  // Docker en localhost
        port: 6379,         // Puerto por defecto
      },
    }),
    
    DatabaseModule,
    UsersModule,
    AuthModule,
    TagsModule,
    ContactsModule,
    TemplatesModule, // ¡AGREGA ESTO!
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [],
})
export class AppModule {}