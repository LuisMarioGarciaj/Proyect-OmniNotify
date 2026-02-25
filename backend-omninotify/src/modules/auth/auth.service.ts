// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CompaniesService } from '../companies/companies.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private companiesService: CompaniesService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValid = await this.usersService.validatePassword(
      password,
      user.password,
    );

    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Obtener nombre de empresa + estado de WhatsApp en paralelo
    let companyName = '';
    let whatsappConfigured = false;

    try {
      const [company, whatsappStatus] = await Promise.all([
        this.companiesService.findOne(user.company_id),
        this.companiesService.getWhatsappStatus(user.company_id),
      ]);

      companyName = company?.name || '';
      whatsappConfigured = whatsappStatus.configured;

      console.log(`📊 Empresa: ${companyName} | WhatsApp configurado: ${whatsappConfigured}`);
    } catch (error) {
      console.error(`❌ Error al obtener datos de empresa: ${error.message}`);
    }

    const payload = {
      sub: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
        company_name: companyName,
        // ✅ El frontend usa esto para saber si mostrar el modal de setup
        whatsapp_configured: whatsappConfigured,
      },
    };
  }
}