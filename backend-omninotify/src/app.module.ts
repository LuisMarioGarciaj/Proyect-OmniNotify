import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Importa los módulos que YA EXISTEN
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

// Importa los módulos NUEVOS (crearas después)
// import { CompaniesModule } from './modules/companies/companies.module';
// import { ContactsModule } from './modules/contacts/contacts.module';
// import { TagsModule } from './modules/tags/tags.module';
// import { TemplatesModule } from './modules/templates/templates.module';
// import { NotificationsModule } from './modules/notifications/notifications.module';
// import { ProvidersModule } from './modules/providers/providers.module';

@Module({
  imports: [
    DatabaseModule, // ⭐ ESTO CONECTA TODO A MYSQL
    AuthModule,
    UsersModule,
    // Después descomenta y agrega los otros módulos
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}