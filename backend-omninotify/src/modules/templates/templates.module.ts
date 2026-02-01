// src/modules/templates/templates.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { Template } from './entities/template.entity';
import { TemplateProcessorService } from './template-processor.service'; // 1. Importar el nuevo servicio

@Module({
  imports: [
    TypeOrmModule.forFeature([Template])
  ],
  controllers: [TemplatesController],
  providers: [
    TemplatesService, 
    TemplateProcessorService // 2. Registrar el procesador
  ],
  exports: [
    TemplatesService, 
    TemplateProcessorService // 3. Exportar para que el módulo de Notificaciones pueda usarlo
  ],
})
export class TemplatesModule {
  constructor() {
    console.log('✅ TemplatesModule cargado - Usando tabla: Template y Procesador de Plantillas');
  }
}