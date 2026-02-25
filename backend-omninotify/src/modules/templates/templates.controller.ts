import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Logger, 
  Request, 
  UseGuards,
  UsePipes,
  ValidationPipe 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('templates')
@UseGuards(JwtAuthGuard)  // Protege todas las rutas con JWT
export class TemplatesController {
  private readonly logger = new Logger(TemplatesController.name);

  constructor(private readonly templatesService: TemplatesService) {
    this.logger.log('✅ TemplatesController usando tabla "Template"');
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(@Body() createTemplateDto: CreateTemplateDto, @Request() req) {
    this.logger.log(`📝 Creando template: ${createTemplateDto.name}`);
    this.logger.log(`👤 Usuario: ${req.user.email}, Compañía: ${req.user.companyId}`);
    
    try {
      // Pasa el companyId del usuario autenticado
      const result = await this.templatesService.create(createTemplateDto, req.user.companyId);
      
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
  async findByCompany(@Param('companyId') companyId: string, @Request() req) {
    this.logger.log(`🔍 Buscando templates para company: ${companyId}`);
    this.logger.log(`👤 Usuario solicitante: ${req.user.email}`);
    
    // Verifica que el usuario tenga acceso a esta compañía
    if (req.user.companyId !== companyId) {
      return {
        success: false,
        message: 'No tienes permisos para acceder a estos templates',
        data: [],
        timestamp: new Date().toISOString()
      };
    }
    
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

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    this.logger.log(`🔍 Buscando template: ${id}`);
    this.logger.log(`👤 Usuario: ${req.user.email}`);
    
    try {
      const template = await this.templatesService.findOne(id, req.user.companyId);
      
      return {
        success: true,
        message: '✅ Template encontrado',
        data: template,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      this.logger.error(`❌ Error: ${error.message}`);
      return {
        success: false,
        message: error.message,
        data: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Put(':id')
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param('id') id: string, 
    @Body() updateTemplateDto: UpdateTemplateDto, 
    @Request() req
  ) {
    this.logger.log(`✏️ Actualizando template: ${id}`);
    this.logger.log(`👤 Usuario: ${req.user.email}`);
    
    try {
      const template = await this.templatesService.update(id, updateTemplateDto, req.user.companyId);
      
      return {
        success: true,
        message: '✅ Template actualizado exitosamente',
        data: template,
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

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    this.logger.log(`🗑️ Eliminando template: ${id}`);
    this.logger.log(`👤 Usuario: ${req.user.email}`);
    
    try {
      const result = await this.templatesService.remove(id, req.user.companyId);
      
      return {
        success: true,
        message: result.message,
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
}