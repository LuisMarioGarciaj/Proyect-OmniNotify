// src/modules/credits/credits.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios'; // 👈 IMPORTANTE para llamadas HTTP a YOPAGO
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';
import { CreditTransaction } from './entities/credit-transaction.entity';
import { Company } from '../companies/entities/company.entity';
import { CompaniesModule } from '../companies/companies.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreditTransaction, Company]),
    HttpModule, // 👈 NECESARIO para llamar a la API de YOPAGO
    forwardRef(() => CompaniesModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}