// src/modules/templates/templates.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Logger } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('templates')
export class TemplatesController {
  private readonly logger = new Logger(TemplatesController.name);

  constructor(private readonly templatesService: TemplatesService) {
    this.logger.log('✅ TemplatesController usando tabla "Template"');
  }

  @Get('test/hello')
  testHello() {
    return {
      message: '¡Templates Module usando tabla EXISTENTE "Template"! 🎉',
      timestamp: new Date().toISOString(),
      status: 'active',
      table: 'Template',
      foreignKey: 'company_id → Company(id)',
      endpoints: {
        create: 'POST /templates',
        findByCompany: 'GET /templates/company/:companyId',
        getOne: 'GET /templates/:id/company/:companyId',
        update: 'PUT /templates/:id/company/:companyId',
        delete: 'DELETE /templates/:id/company/:companyId',
        testService: 'GET /templates/test/service',
      }
    };
  }

  @Get('test/service')
  async testService() {
    return await this.templatesService.test();
  }

  @Post()
  async create(@Body() createTemplateDto: CreateTemplateDto) {
    this.logger.log(`📝 Creando template: ${createTemplateDto.name}`);
    try {
      const result = await this.templatesService.create(createTemplateDto);
      return {
        success: true,
        message: '✅ Template creado exitosamente en tabla "Template"!',
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      this.logger.error(`❌ Error: ${error.message}`);
      return {
        success: false,
        message: error.message,
        error: error.response?.message || error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get('company/:companyId')
  async findByCompany(@Param('companyId') companyId: string) {
    this.logger.log(`🔍 Buscando templates para company: ${companyId}`);
    try {
      const templates = await this.templatesService.findAllByCompany(companyId);
      return {
        success: true,
        count: templates.length,
        message: `✅ ${templates.length} templates encontrados en tabla "Template"`,
        data: templates,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        data: [],
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get(':id/company/:companyId')
  async findOne(
    @Param('id') id: string,
    @Param('companyId') companyId: string,
  ) {
    this.logger.log(`🔍 Buscando template ${id} para company: ${companyId}`);
    try {
      const template = await this.templatesService.findOne(id, companyId);
      return {
        success: true,
        data: template,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Put(':id/company/:companyId')
  async update(
    @Param('id') id: string,
    @Param('companyId') companyId: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    this.logger.log(`✏️ Actualizando template ${id}`);
    try {
      const template = await this.templatesService.update(id, companyId, updateTemplateDto);
      return {
        success: true,
        message: '✅ Template actualizado exitosamente',
        data: template,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Delete(':id/company/:companyId')
  async remove(
    @Param('id') id: string,
    @Param('companyId') companyId: string,
  ) {
    this.logger.log(`🗑️ Eliminando template ${id}`);
    try {
      await this.templatesService.remove(id, companyId);
      return {
        success: true,
        message: '✅ Template eliminado exitosamente',
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}