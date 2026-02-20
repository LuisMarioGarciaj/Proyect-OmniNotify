import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Company } from './entities/company.entity';
import { CompanyProviderConfig } from '../providers/entities/company-provider-config.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { SetupWhatsappDto } from './dto/setup-whatsapp.dto';

// El provider_id = 1 corresponde a Nexo WhatsApp (hardcodeado según tu DB)
const NEXO_WHATSAPP_PROVIDER_ID = 1;

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(CompanyProviderConfig)
    private readonly providerConfigRepo: Repository<CompanyProviderConfig>,
  ) {}

  // ─────────────────────────────────────────────
  // COMPANY CRUD
  // ─────────────────────────────────────────────

  async findOne(id: string) {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException(`Compañía con ID ${id} no encontrada`);
    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    const company = await this.findOne(id);
    const updatedCompany = this.companyRepo.merge(company, updateCompanyDto);
    return await this.companyRepo.save(updatedCompany);
  }

  // ─────────────────────────────────────────────
  // WHATSAPP PROVIDER SETUP
  // ─────────────────────────────────────────────

  /**
   * Crea o actualiza la config de WhatsApp (Nexo) para una empresa.
   * Si ya existe, actualiza el token. Si no existe, crea el registro.
   */
  async setupWhatsapp(companyId: string, dto: SetupWhatsappDto) {
    // Verificar que la empresa exista
    await this.findOne(companyId);

    // Buscar si ya tiene config de WhatsApp
    const existing = await this.providerConfigRepo.findOne({
      where: { companyId, providerId: NEXO_WHATSAPP_PROVIDER_ID },
    });

    if (existing) {
      // ✅ Ya existe → actualizar token
      existing.config = {
        ...existing.config,
        token: dto.token,
        status: 'ACTIVE',
        environment: dto.environment || 'production',
        updatedAt: new Date().toISOString(),
      };
      await this.providerConfigRepo.save(existing);

      return {
        success: true,
        message: 'Configuración de WhatsApp actualizada',
        data: { companyId, provider: 'NEXO_WHATSAPP', status: 'ACTIVE' },
      };
    }

    // ✅ No existe → crear nuevo registro
    const newConfig = this.providerConfigRepo.create({
      id: uuidv4(),
      companyId,
      providerId: NEXO_WHATSAPP_PROVIDER_ID,
      config: {
        token: dto.token,
        status: 'ACTIVE',
        environment: dto.environment || 'production',
        configuredAt: new Date().toISOString(),
        configuredBy: dto.configuredBy || 'admin',
      },
    });

    await this.providerConfigRepo.save(newConfig);

    return {
      success: true,
      message: 'WhatsApp configurado exitosamente',
      data: { companyId, provider: 'NEXO_WHATSAPP', status: 'ACTIVE' },
    };
  }

  /**
   * Verifica si una empresa tiene WhatsApp configurado y activo.
   * Útil para el frontend al hacer login.
   */
  async getWhatsappStatus(companyId: string) {
    const config = await this.providerConfigRepo.findOne({
      where: { companyId, providerId: NEXO_WHATSAPP_PROVIDER_ID },
    });

    if (!config) {
      return { configured: false, status: null };
    }

    return {
      configured: true,
      status: config.config?.status || 'UNKNOWN',
      environment: config.config?.environment || 'production',
      configuredAt: config.config?.configuredAt || null,
    };
  }
}