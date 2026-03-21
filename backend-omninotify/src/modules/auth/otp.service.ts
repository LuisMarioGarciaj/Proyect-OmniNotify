import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { OtpToken } from './entities/otp-token.entity';

@Injectable()
export class OtpService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(OtpToken)
    private otpRepo: Repository<OtpToken>,
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

  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async saveOtp(userId: string, code: string): Promise<void> {
    await this.otpRepo.delete({ user_id: userId });

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    const otp = this.otpRepo.create({ user_id: userId, code, expires_at: expiresAt });
    await this.otpRepo.save(otp);
  }

  async verifyOtp(userId: string, code: string): Promise<boolean> {
    const otp = await this.otpRepo.findOne({
      where: { user_id: userId, code },
    });

    if (!otp) return false;

    if (otp.expires_at < new Date()) {
      await this.otpRepo.delete({ id: otp.id });
      return false;
    }

    await this.otpRepo.delete({ id: otp.id });
    return true;
  }

  async sendWelcomeEmail(email: string, name: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"Omni-Notify" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `¡Bienvenid@ a Omni-Notify, ${name}! 🎉`,
      html: this.buildWelcomeEmailHtml(name, code),
    });
  }

  private buildWelcomeEmailHtml(name: string, code: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0fff4;padding:40px 20px}
  .card{max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(16,185,129,.12)}
  .header{background:linear-gradient(135deg,#059669,#0d9488);padding:48px 32px;text-align:center}
  .emoji{font-size:52px;display:block;margin-bottom:16px}
  .header h1{color:#fff;font-size:26px;font-weight:800;margin-bottom:8px}
  .header p{color:rgba(255,255,255,.85);font-size:15px}
  .badge{display:inline-block;background:rgba(255,255,255,.2);color:#fff;font-size:12px;font-weight:600;padding:6px 16px;border-radius:20px;margin-top:16px;letter-spacing:.5px}
  .body{padding:36px 32px}
  .welcome-msg{font-size:17px;color:#111827;font-weight:600;margin-bottom:12px}
  .desc{font-size:14px;color:#6b7280;line-height:1.7;margin-bottom:28px}
  .features{display:grid;gap:12px;margin-bottom:28px}
  .feature{display:flex;align-items:center;gap:12px;background:#f0fdf4;border-radius:12px;padding:14px}
  .feature-icon{width:36px;height:36px;background:linear-gradient(135deg,#059669,#0d9488);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .feature-text{font-size:13px;color:#374151;font-weight:500}
  .divider{border:none;border-top:1px solid #f3f4f6;margin:8px 0 24px}
  .otp-section{background:linear-gradient(135deg,#f0f4ff,#e8ecff);border:2px solid #c7d2fe;border-radius:16px;padding:24px;text-align:center;margin-bottom:8px}
  .otp-title{font-size:13px;color:#6366f1;font-weight:600;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}
  .code{font-size:40px;font-weight:800;letter-spacing:12px;color:#4F63F5;font-variant-numeric:tabular-nums}
  .timer{display:inline-flex;align-items:center;gap:6px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:600;padding:6px 14px;border-radius:20px;margin-top:16px}
  .footer{background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #f3f4f6}
  .footer p{font-size:12px;color:#9ca3af}
</style></head>
<body>
<div class="card">
  <div class="header">
    <span class="emoji">🎉</span>
    <h1>¡Bienvenid@, ${name}!</h1>
    <p>Tu cuenta en Omni-Notify está lista</p>
    <span class="badge">✦ CUENTA ACTIVADA</span>
  </div>
  <div class="body">
    <p class="welcome-msg">Nos alegra tenerte aquí 🚀</p>
    <p class="desc">Ahora tienes acceso a la plataforma de notificaciones inteligente. Gestiona contactos, plantillas y envíos desde un solo lugar.</p>
    <div class="features">
      <div class="feature">
        <div class="feature-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          </svg>
        </div>
        <span class="feature-text">Gestión de contactos y segmentación por etiquetas</span>
      </div>
      <div class="feature">
        <div class="feature-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
        </div>
        <span class="feature-text">Plantillas de email, SMS y WhatsApp personalizadas</span>
      </div>
      <div class="feature">
        <div class="feature-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          </svg>
        </div>
        <span class="feature-text">Envío masivo de notificaciones en tiempo real</span>
      </div>
    </div>
    <hr class="divider">
    <p style="font-size:13px;color:#374151;margin-bottom:16px;font-weight:500">
      Para completar tu primer acceso, ingresa este código:
    </p>
    <div class="otp-section">
      <div class="otp-title">Tu código de verificación</div>
      <div class="code">${code}</div>
      <div class="timer">⏱ Válido por 5 minutos</div>
    </div>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Omni-Notify · Con ❤️ para tu negocio</p>
  </div>
</div>
</body></html>`;
  }
}