import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module'; 

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    CompaniesModule, 
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}