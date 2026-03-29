// src/modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyProviderConfig } from '../providers/entities/company-provider-config.entity'; // ✅ NUEVO
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { OtpService } from '../auth/otp.service'; // Importar OtpService
import { OtpToken } from '../auth/entities/otp-token.entity'; // Importar entidad

@Module({
  imports: [TypeOrmModule.forFeature([
    User,
    Company,
    CompanyProviderConfig, 
    OtpToken,
  ])],
  controllers: [UsersController],
  providers: [UsersService,OtpService],
  exports: [UsersService],
})
export class UsersModule {}