// src/modules/credits/credits.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { Company } from '../companies/entities/company.entity';
import { CreditTransaction } from './entities/credit-transaction.entity';
import { CreditRecharge } from './entities/credit-recharge.entity';
import { ChannelCost } from './entities/channel-cost.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CreditTransaction, CreditRecharge, ChannelCost]),
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 15000,
        maxRedirects: 5,
        baseURL: process.env.YOPAGO_API_URL || 'https://yopago.com.bo',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }),
    }),
  ],
  controllers: [CreditsController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}