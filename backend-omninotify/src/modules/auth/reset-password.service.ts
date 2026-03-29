// src/modules/auth/reset-password.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';
import { ResetPasswordToken } from './entities/reset-token.entity';
import { UsersService } from '../users/users.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ResetPasswordService {
  private readonly logger = new Logger(ResetPasswordService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(ResetPasswordToken)
    private resetTokenRepo: Repository<ResetPasswordToken>,
    private usersService: UsersService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async generateToken(userId: string): Promise<string> {
    // Eliminar tokens anteriores del usuario
    await this.resetTokenRepo.delete({ userId });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const resetToken = new ResetPasswordToken();
    resetToken.id = uuidv4();
    resetToken.userId = userId;
    resetToken.token = token;
    resetToken.expiresAt = expiresAt;

    this.logger.log(`Guardando token para usuario ${userId}: ${token}`);

    try {
      const saved = await this.resetTokenRepo.save(resetToken);
      this.logger.log(`Token guardado exitosamente: ${saved.id}`);
      return token;
    } catch (error) {
      this.logger.error(`Error al guardar token: ${error.message}`);
      throw error;
    }
  }

  async sendResetEmail(email: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    this.logger.log(
      `Enviando email de recuperación a ${email} con link: ${resetLink}`,
    );

    await this.transporter.sendMail({
      from: `"Omni-Notify" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Restablece tu contraseña en Omni-Notify 🔐',
      html: this.buildResetEmailHtml(resetLink),
    });
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      this.logger.log(
        `Intento de recuperación para email no registrado: ${email}`,
      );
      return {
        message:
          'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
      };
    }

    this.logger.log(`Generando token para usuario: ${user.id} (${email})`);
    const token = await this.generateToken(user.id);
    await this.sendResetEmail(email, token);

    return {
      message:
        'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.',
    };
  }

  async validateToken(
    token: string,
  ): Promise<{ userId: string; isValid: boolean }> {
    this.logger.log(`Validando token: ${token}`);

    const resetToken = await this.resetTokenRepo.findOne({
      where: { token },
    });

    if (!resetToken) {
      this.logger.warn(`Token no encontrado: ${token}`);
      return { userId: '', isValid: false };
    }

    this.logger.log(
      `Token encontrado para usuario ${resetToken.userId}, expira: ${resetToken.expiresAt}`,
    );

    if (resetToken.expiresAt < new Date()) {
      this.logger.warn(`Token expirado para usuario ${resetToken.userId}`);
      await this.resetTokenRepo.delete({ id: resetToken.id });
      return { userId: '', isValid: false };
    }

    return { userId: resetToken.userId, isValid: true };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Intentando resetear contraseña con token: ${token}`);

    const { userId, isValid } = await this.validateToken(token);

    if (!isValid) {
      throw new BadRequestException('El enlace ha expirado o no es válido');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(userId, hashedPassword);

    // Eliminar el token usado
    await this.resetTokenRepo.delete({ token });
    this.logger.log(`Contraseña actualizada para usuario ${userId}`);

    return { success: true, message: 'Contraseña actualizada exitosamente' };
  }
  private buildResetEmailHtml(resetLink: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Restablecer contraseña</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;padding:40px 20px}
    .container{max-width:500px;margin:0 auto}
    .card{background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)}
    .header{background:linear-gradient(135deg,#2563eb,#1e40af);padding:32px;text-align:center}
    .header h1{color:#fff;font-size:24px;margin-bottom:8px}
    .header p{color:rgba(255,255,255,0.85);font-size:14px}
    .content{padding:32px}
    .message{font-size:16px;color:#1f2937;margin-bottom:24px;line-height:1.6}
    .button{display:inline-block;background:linear-gradient(135deg,#2563eb,#1e40af);color:#fff;text-decoration:none;padding:12px 32px;border-radius:12px;font-weight:600;margin:16px 0}
    .button:hover{background:linear-gradient(135deg,#1e40af,#1e3a8a)}
    .expiry{font-size:13px;color:#6b7280;text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb}
    .footer{background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#9ca3af}
  </style>
</head>
<body>
<div class="container">
  <div class="card">
    <div class="header">
      <h1>🔐 Restablecer contraseña</h1>
      <p>Omni-Notify</p>
    </div>
    <div class="content">
      <p class="message">Hemos recibido una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña.</p>
      <div style="text-align:center">
        <a href="${resetLink}" class="button">Restablecer contraseña</a>
      </div>
      <p class="expiry">Este enlace expirará en <strong>1 hora</strong>.</p>
      <p style="font-size:13px;color:#6b7280;margin-top:24px">Si no solicitaste este cambio, puedes ignorar este correo.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Omni-Notify · Plataforma de notificaciones inteligente</p>
    </div>
  </div>
</div>
</body>
</html>`;
  }
}
