// src/modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyProviderConfig } from '../providers/entities/company-provider-config.entity'; // ✅ NUEVO
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
    User,
    Company,
    CompanyProviderConfig, 
  ])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}