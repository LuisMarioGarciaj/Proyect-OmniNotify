// src/modules/system/system.module.ts
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfig } from './entities/system-config.entity';
import { SystemConfigService } from './services/system-config.service';
import { SystemConfigController } from './system-config.controller';

@Global() // Hacerlo global para que esté disponible en toda la app
@Module({
  imports: [
    TypeOrmModule.forFeature([SystemConfig]),
  ],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemModule {}