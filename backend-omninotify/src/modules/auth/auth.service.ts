  import { Injectable, UnauthorizedException } from '@nestjs/common';
  import { JwtService } from '@nestjs/jwt';
  import { UsersService } from '../users/users.service';
  import { CompaniesService } from '../companies/companies.service';
  import { OtpService } from './otp.service';
  import { ResetPasswordService } from './reset-password.service';

  @Injectable()
  export class AuthService {
    constructor(
      private usersService: UsersService,
      private jwtService: JwtService,
      private companiesService: CompaniesService,
      private otpService: OtpService,
      private resetPasswordService: ResetPasswordService,
    ) { }

    async login(email: string, password: string) {
      const user = await this.usersService.findByEmail(email);
      if (!user) throw new UnauthorizedException('Credenciales inválidas');
      // 🔥 NUEVA VALIDACIÓN: Verificar que la cuenta esté activa
    if (user.status === 'PENDING_VERIFICATION') {
      // Reenviar el código OTP si es necesario
      const smtpConfigured = !!(
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
      );

      if (smtpConfigured) {
        // Generar nuevo código y enviarlo
        const code = this.otpService.generateCode();
        await this.otpService.saveOtp(user.id, code);
        await this.otpService.sendVerificationEmail(user.email, user.name, code);
        
     // ✅ CORRECCIÓN: Lanzar la excepción con el formato correcto
      throw new UnauthorizedException({
        message: 'Por favor verifica tu cuenta antes de iniciar sesión. Hemos enviado un nuevo código de verificación a tu correo.',
        requires_verification: true,
        user_id: user.id,
        email: user.email,
      });
    } else {
      throw new UnauthorizedException('Por favor verifica tu cuenta antes de iniciar sesión. Contacta al administrador si no recibiste el correo de verificación.');
    }
  }


    if (user.status === 'DISABLED') {
      throw new UnauthorizedException('Tu cuenta ha sido deshabilitada. Contacta al administrador.');
    }

      const isValid = await this.usersService.validatePassword(password, user.password);
      if (!isValid) throw new UnauthorizedException('Credenciales inválidas');

      // ── Primer login: intentar flujo OTP solo si SMTP está configurado ────────
      // Si SMTP no está en el .env (desarrollo / pruebas), saltamos el OTP
      // y devolvemos el token directamente para no bloquear el acceso.
      if (user.is_first_login) {
        const smtpConfigured = !!(
          process.env.SMTP_HOST &&
          process.env.SMTP_USER &&
          process.env.SMTP_PASS
        );

        if (smtpConfigured) {
          // SMTP disponible → flujo OTP estándar
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

        // SMTP no configurado → marcar primer login como hecho y devolver token
        // igual que un login normal. Así no se bloquea en entornos sin email.
        await this.usersService.markFirstLoginDone(user.id);
      }

      // ── Login normal ──────────────────────────────────────────────────────────
      const { access_token, userData } = await this.buildTokenResponse(user);
      return { access_token, user: userData };
    }

    async verifyOtp(userId: string, code: string) {
      const isValid = await this.otpService.verifyOtp(userId, code);
      if (!isValid) throw new UnauthorizedException('Código inválido o expirado');

      await this.usersService.markFirstLoginDone(userId);

      const user = await this.usersService.findById(userId);
      if (!user) throw new UnauthorizedException('Usuario no encontrado');

      const { access_token, userData } = await this.buildTokenResponse(user);
       return { 
    access_token, 
    user: {
      ...userData,
      is_first_login: true  // Aunque ya lo marcamos como hecho, el frontend necesita saber
    }
  };
    }

    // ── Helper compartido: construye el token y datos de usuario ──────────────
    // Mismo formato de respuesta que el auth.service.ts anterior:
    // { access_token, user: { id, email, name, role, company_id, company_name, whatsapp_configured } }
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
    async forgotPassword(email: string): Promise<{ message: string }> {
      return this.resetPasswordService.requestPasswordReset(email);
    }

    /**
     * Valida un token de restablecimiento
     */
    async validateResetToken(
      token: string,
    ): Promise<{ isValid: boolean; userId?: string }> {
      const result = await this.resetPasswordService.validateToken(token);
      return { isValid: result.isValid, userId: result.userId };
    }

    /**
     * Restablece la contraseña
     */
    async resetPassword(
      token: string,
      newPassword: string,
    ): Promise<{ message: string }> {
      await this.resetPasswordService.resetPassword(token, newPassword);
      return { message: 'Contraseña actualizada exitosamente' };
    }
  }