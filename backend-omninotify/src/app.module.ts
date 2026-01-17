import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Importa los módulos que YA EXISTEN
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ConfigModule } from '@nestjs/config';
// Importa los módulos NUEVOS (crearas después)
// import { CompaniesModule } from './modules/companies/companies.module';
// import { ContactsModule } from './modules/contacts/contacts.module';
import { TagsModule } from './modules/tags/tags.module';
// import { TemplatesModule } from './modules/templates/templates.module';
// import { NotificationsModule } from './modules/notifications/notifications.module';
// import { ProvidersModule } from './modules/providers/providers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    TagsModule,
  ],
   controllers: [AppController],  // ← ¡AGREGA ESTO!
  providers: [AppService],       // ← ¡AGREGA ESTO!
  exports: [],
})
export class AppModule {}