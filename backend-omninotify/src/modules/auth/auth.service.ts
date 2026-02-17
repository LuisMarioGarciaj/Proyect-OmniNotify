// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { CompaniesService } from '../companies/companies.service'; // <-- IMPORTAR

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private companiesService: CompaniesService, // <-- INYECTAR
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

    // OBTENER EL NOMBRE DE LA EMPRESA
    let companyName = '';
    try {
      const company = await this.companiesService.findOne(user.company_id);
      companyName = company?.name || '';
      console.log(`📊 Empresa encontrada: ${companyName} para company_id: ${user.company_id}`);
    } catch (error) {
      console.error(`❌ Error al obtener empresa: ${error.message}`);
      // Si hay error, dejar companyName vacío
    }

    const payload = {
      sub: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email,
    };

    console.log('📦 Payload JWT:', payload);

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
        company_name: companyName // <-- ¡AÑADIDO!
      }
    };
  }
}