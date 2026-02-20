import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { SetupWhatsappDto } from './dto/setup-whatsapp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // ─────────────────────────────────────────────
  // COMPANY
  // ─────────────────────────────────────────────

  @Get(':id')
  async getCompany(@Param('id') id: string, @Request() req) {
    this.assertSameCompany(id, req.user.companyId);
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  async updateCompany(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @Request() req,
  ) {
    this.assertSameCompany(id, req.user.companyId);
    return this.companiesService.update(id, updateCompanyDto);
  }

  // ─────────────────────────────────────────────
  // WHATSAPP PROVIDER
  // ─────────────────────────────────────────────

  /**
   * POST /companies/:id/setup-whatsapp
   * 
   * Crea o actualiza el token de WhatsApp (Nexo) para la empresa.
   * Se llama una vez después del login si no está configurado,
   * o desde la pantalla de Settings.
   * 
   * Body: { token: "15c461b4-...", environment: "production" }
   */
  @Post(':id/setup-whatsapp')
  async setupWhatsapp(
    @Param('id') id: string,
    @Body() dto: SetupWhatsappDto,
    @Request() req,
  ) {
    this.assertSameCompany(id, req.user.companyId);
    // Pasar el email del usuario que configuró
    dto.configuredBy = dto.configuredBy || req.user.email;
    return this.companiesService.setupWhatsapp(id, dto);
  }

  /**
   * GET /companies/:id/whatsapp-status
   * 
   * El frontend lo llama al hacer login para saber si WhatsApp
   * ya está configurado. Si returns { configured: false }, muestra
   * el modal de setup.
   */
  @Get(':id/whatsapp-status')
  async getWhatsappStatus(@Param('id') id: string, @Request() req) {
    this.assertSameCompany(id, req.user.companyId);
    return this.companiesService.getWhatsappStatus(id);
  }

  // ─────────────────────────────────────────────
  // HELPER PRIVADO
  // ─────────────────────────────────────────────

  private assertSameCompany(paramId: string, tokenCompanyId: string) {
    if (paramId !== tokenCompanyId) {
      throw new ForbiddenException('No tienes permiso para acceder a esta compañía');
    }
  }
}