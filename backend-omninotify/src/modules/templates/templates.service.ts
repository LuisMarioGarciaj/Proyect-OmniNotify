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
      const template = this.templateRepository.create({
        ...createTemplateDto,
        company_id: companyId,
      });

      return await this.templateRepository.save(template);
    } catch (error: any) {
      this.logger.error(`❌ Error creando template: ${error.message}`);
      throw new BadRequestException(`Error creando template: ${error.message}`);
    }
  }

  async findAllByCompany(companyId: string): Promise<Template[]> {
    this.logger.log(`🔍 Buscando templates para company: ${companyId}`);
    
    try {
      // NO uses order: { created_at: 'DESC' } porque no existe en la tabla
      const templates = await this.templateRepository.find({
        where: { company_id: companyId },
        // Si quieres ordenar por algo, podría ser por nombre
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
      
      Object.assign(template, updateTemplateDto);
      
      return await this.templateRepository.save(template);
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