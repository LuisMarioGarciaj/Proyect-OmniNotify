import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CompaniesService } from '../companies/companies.service';
import { OtpService } from './otp.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private companiesService: CompaniesService,
    private otpService: OtpService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const isValid = await this.usersService.validatePassword(password, user.password);
    if (!isValid) throw new UnauthorizedException('Credenciales inválidas');

    // ── Login normal (no es primer login) ──────────────────────────────────
    if (!user.is_first_login) {
      const { access_token, userData } = await this.buildTokenResponse(user);
      return { access_token, user: userData };
    }

    // ── Primer login: enviar email de bienvenida con OTP ───────────────────
    const code = this.otpService.generateCode();
    await this.otpService.saveOtp(user.id, code);
    await this.otpService.sendWelcomeEmail(user.email, user.name, code);

    return {
      requires_otp: true,
      user_id: user.id,
      email: user.email,
      is_first_login: true,
    };
  }

  async verifyOtp(userId: string, code: string) {
    const isValid = await this.otpService.verifyOtp(userId, code);
    if (!isValid) throw new UnauthorizedException('Código inválido o expirado');

    await this.usersService.markFirstLoginDone(userId);

    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const { access_token, userData } = await this.buildTokenResponse(user);
    return { access_token, user: userData };
  }

  // ── Helper compartido para construir el token y datos de usuario ──────────
  private async buildTokenResponse(user: any) {
    let companyName = '';
    let whatsappConfigured = false;

    try {
      const [company, whatsappStatus] = await Promise.all([
        this.companiesService.findOne(user.company_id),
        this.companiesService.getWhatsappStatus(user.company_id),
      ]);
      companyName = company?.name || '';
      whatsappConfigured = whatsappStatus.configured;
    } catch (error: any) {
      console.error(`Error obteniendo datos de empresa: ${error.message}`);
    }

    const payload = {
      sub: user.id,
      companyId: user.company_id,
      role: user.role,
      email: user.email,
    };

    return {
      access_token: this.jwtService.sign(payload),
      userData: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
        company_name: companyName,
        whatsapp_configured: whatsappConfigured,
      },
    };
  }
}