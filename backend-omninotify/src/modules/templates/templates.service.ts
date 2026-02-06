import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
  ) {
    this.logger.log('✅ TemplatesService usando tabla EXISTENTE: Template');
  }

  async create(createTemplateDto: CreateTemplateDto): Promise<Template> {
    this.logger.log(`📝 Creando template: ${createTemplateDto.name}`);
    
    // Validaciones básicas
    if (!createTemplateDto.name || !createTemplateDto.content) {
      throw new BadRequestException('Nombre y contenido son requeridos');
    }
    
    if (!createTemplateDto.companyId) {
      throw new BadRequestException('companyId es requerido');
    }
    
    try {
      // Crear instancia de Template CORRECTAMENTE
      const template = new Template();
      template.id = uuidv4(); // UUID generado manualmente
      template.company_id = createTemplateDto.companyId;
      template.channel = createTemplateDto.channel;
      template.name = createTemplateDto.name;
      template.content = createTemplateDto.content;
      template.provider_template_id = createTemplateDto.provider_template_id || null;
      
      const saved = await this.templateRepository.save(template);
      this.logger.log(`✅ INSERT INTO Template - ID: ${saved.id}`);
      return saved;
    } catch (error: any) {
      this.logger.error(`❌ Error MySQL: ${error.message}`);
      
      // Manejo especial para error de foreign key
      if (error.message.includes('foreign key constraint') || error.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new BadRequestException(`El companyId '${createTemplateDto.companyId}' no existe en la tabla Company`);
      }
      
      throw new BadRequestException(`Error en base de datos: ${error.message}`);
    }
  }

  async findAllByCompany(companyId: string): Promise<Template[]> {
    this.logger.log(`🔍 Buscando templates para company: ${companyId}`);
    
    try {
      const templates = await this.templateRepository.find({
        where: { company_id: companyId },
        order: { name: 'ASC' },
      });
      
      this.logger.log(`✅ Encontrados ${templates.length} templates`);
      return templates;
    } catch (error: any) {
      this.logger.error(`❌ Error MySQL: ${error.message}`);
      throw new BadRequestException(`Error en base de datos: ${error.message}`);
    }
  }

  async findOne(id: string, companyId: string): Promise<Template> {
    this.logger.log(`🔍 Buscando template ${id} para company: ${companyId}`);
    
    try {
      const template = await this.templateRepository.findOne({
        where: { id, company_id: companyId },
      });
      
      if (!template) {
        throw new NotFoundException(`Template con ID ${id} no encontrado para esta compañía`);
      }
      
      return template;
    } catch (error: any) {
      this.logger.error(`❌ Error MySQL: ${error.message}`);
      throw error;
    }
  }

  async update(id: string, companyId: string, updateTemplateDto: UpdateTemplateDto): Promise<Template> {
    this.logger.log(`✏️ Actualizando template ${id}`);
    
    try {
      const template = await this.findOne(id, companyId);
      
      // Actualizar solo campos proporcionados
      if (updateTemplateDto.name !== undefined) {
        template.name = updateTemplateDto.name;
      }
      if (updateTemplateDto.channel !== undefined) {
        template.channel = updateTemplateDto.channel;
      }
      if (updateTemplateDto.content !== undefined) {
        template.content = updateTemplateDto.content;
      }
      if (updateTemplateDto.companyId !== undefined) {
        template.company_id = updateTemplateDto.companyId;
      }
      if (updateTemplateDto.provider_template_id !== undefined) {
        template.provider_template_id = updateTemplateDto.provider_template_id;
      }
      
      const updated = await this.templateRepository.save(template);
      this.logger.log(`✅ Template ${id} actualizado`);
      return updated;
    } catch (error: any) {
      this.logger.error(`❌ Error actualizando: ${error.message}`);
      throw error;
    }
  }

  async remove(id: string, companyId: string): Promise<void> {
    this.logger.log(`🗑️ Eliminando template ${id}`);
    
    try {
      const template = await this.findOne(id, companyId);
      await this.templateRepository.remove(template);
      this.logger.log(`✅ Template ${id} eliminado`);
    } catch (error: any) {
      this.logger.error(`❌ Error eliminando: ${error.message}`);
      throw error;
    }
  }

  async test(): Promise<any> {
    try {
      const count = await this.templateRepository.count();
      const sample = await this.templateRepository.find({ take: 1 });
      
      return {
        message: '✅ TemplatesService CONECTADO a tabla EXISTENTE "Template"',
        timestamp: new Date().toISOString(),
        totalTemplatesInMySQL: count,
        sampleTemplate: sample[0] || 'No hay templates aún',
        tableName: 'Template',
        status: 'MYSQL_ACTIVE',
        database: process.env.DB_NAME || 'omninotify',
        host: process.env.DB_HOST || 'caboose.proxy.rlwy.net',
        port: process.env.DB_PORT || '57302',
        structure: {
          primaryKey: 'id (uuid)',
          foreignKey: 'company_id references Company(id)',
          columns: ['company_id', 'channel', 'name', 'content', 'provider_template_id']
        }
      };
    } catch (error: any) {
      return {
        message: '❌ ERROR conectando a tabla Template',
        error: error.message,
        timestamp: new Date().toISOString(),
        status: 'MYSQL_DISCONNECTED',
        tableName: 'Template'
      };
    }
  }
}