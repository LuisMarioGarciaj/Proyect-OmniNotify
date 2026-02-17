// src/modules/templates/templates.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
  ) {
    this.logger.log('✅ TemplatesService inicializado usando tabla "Template"');
  }

  async create(createTemplateDto: CreateTemplateDto, companyId: string) {
    this.logger.log(`📝 Creando template: ${createTemplateDto.name} para company: ${companyId}`);
    
    try {
      // Generar alias automáticamente si no viene
      const alias = createTemplateDto.alias || this.generateAlias(createTemplateDto.name);
      
      const templateData = {
        ...createTemplateDto,
        alias, // Usar el alias generado o el proporcionado
        company_id: companyId,
      };

      const template = this.templateRepository.create(templateData);
      const saved = await this.templateRepository.save(template);
      
      this.logger.log(`✅ Template creado con ID: ${saved.id}, alias: ${saved.alias}`);
      return saved;
    } catch (error: any) {
      this.logger.error(`❌ Error creando template: ${error.message}`);
      throw new BadRequestException(`Error creando template: ${error.message}`);
    }
  }

  // Método auxiliar para generar alias automáticamente
  private generateAlias(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .replace(/[^a-z0-9]+/g, '_') // Reemplazar caracteres no alfanuméricos con _
      .replace(/^_|_$/g, ''); // Eliminar guiones bajos al inicio y final
  }

  async findAllByCompany(companyId: string): Promise<Template[]> {
    this.logger.log(`🔍 Buscando templates para company: ${companyId}`);
    
    try {
      const templates = await this.templateRepository.find({
        where: { company_id: companyId },
        order: { name: 'ASC' },
      });
      
      this.logger.log(`✅ Encontrados ${templates.length} templates para company: ${companyId}`);
      return templates;
    } catch (error: any) {
      this.logger.error(`❌ Error buscando templates: ${error.message}`);
      throw new BadRequestException(`Error buscando templates: ${error.message}`);
    }
  }

  async findOne(id: string, companyId: string): Promise<Template> {
    this.logger.log(`🔍 Buscando template: ${id} para company: ${companyId}`);
    
    try {
      const template = await this.templateRepository.findOne({
        where: { id, company_id: companyId },
      });
      
      if (!template) {
        throw new BadRequestException(`Template con ID ${id} no encontrado`);
      }
      
      return template;
    } catch (error: any) {
      this.logger.error(`❌ Error buscando template: ${error.message}`);
      throw new BadRequestException(`Error buscando template: ${error.message}`);
    }
  }

  async update(id: string, updateTemplateDto: UpdateTemplateDto, companyId: string): Promise<Template> {
    this.logger.log(`✏️ Actualizando template: ${id} para company: ${companyId}`);
    
    try {
      const template = await this.templateRepository.findOne({
        where: { id, company_id: companyId },
      });
      
      if (!template) {
        throw new BadRequestException(`Template con ID ${id} no encontrado`);
      }
      
      // Si viene alias, usarlo; si no, mantener el existente o generar uno nuevo si cambió el nombre
      let alias = updateTemplateDto.alias;
      if (!alias && updateTemplateDto.name && updateTemplateDto.name !== template.name) {
        alias = this.generateAlias(updateTemplateDto.name);
      }
      
      const updateData = {
        ...updateTemplateDto,
        ...(alias && { alias }), // Solo incluir alias si se generó o proporcionó
      };
      
      Object.assign(template, updateData);
      const updated = await this.templateRepository.save(template);
      
      this.logger.log(`✅ Template ${id} actualizado`);
      return updated;
    } catch (error: any) {
      this.logger.error(`❌ Error actualizando template: ${error.message}`);
      throw new BadRequestException(`Error actualizando template: ${error.message}`);
    }
  }

  async remove(id: string, companyId: string): Promise<{ message: string }> {
    this.logger.log(`🗑️ Eliminando template: ${id} para company: ${companyId}`);
    
    try {
      const template = await this.templateRepository.findOne({
        where: { id, company_id: companyId },
      });
      
      if (!template) {
        throw new BadRequestException(`Template con ID ${id} no encontrado`);
      }
      
      await this.templateRepository.remove(template);
      
      return { message: `Template con ID ${id} eliminado exitosamente` };
    } catch (error: any) {
      this.logger.error(`❌ Error eliminando template: ${error.message}`);
      throw new BadRequestException(`Error eliminando template: ${error.message}`);
    }
  }
}