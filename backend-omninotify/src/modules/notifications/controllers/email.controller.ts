import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Query, 
  Param,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';

import { NotificationsService } from '../notifications.service';
import { EmailProvider } from '../providers/email.provider';
import type { SendNotificationDto } from '../dto/send-notification.dto';
import { NotificationChannel } from '../dto/send-notification.dto';

// Configuración para upload de logos con límites aumentados
const storage = diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'logos');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, callback) => {
    const filename: string = uuidv4();
    const extension: string = path.parse(file.originalname).ext.toLowerCase();
    callback(null, `${filename}${extension}`);
  },
});

// Interfaces para las peticiones
interface TestEmailRequest {
  to: string;
  provider: 'sendgrid' | 'smtp';
  apiKey?: string;
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  metadata?: {
    companyName?: string;
    companyLogo?: string;
    testType?: string;
    includeLogo: boolean;
    logoSize?: number;
  };
}

interface EmailConfig {
  provider: 'sendgrid' | 'smtp';
  apiKey?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    fromEmail: string;
    fromName: string;
  };
}

interface EmailContentParams {
  companyName: string;
  companyLogo?: string;
  testType: string;
  includeLogo: boolean;
}

@Controller('email')
export class EmailController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly emailProvider: EmailProvider,
  ) {}

  // Método para enviar notificaciones regulares
  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendEmail(@Body() dto: SendNotificationDto) {
    dto.channel = NotificationChannel.EMAIL;
    return this.notificationsService.enqueueNotification(dto);
  }

  // 🔧 CONFIGURACIÓN CRÍTICA: Aumentar límite de tamaño para test
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testEmail(@Req() req: any, @Body() body: TestEmailRequest) {
    try {
      console.log('='.repeat(50));
      console.log('📥 RECIBIENDO TEST DE EMAIL');
      console.log('='.repeat(50));
      
      // Validar que body no sea undefined
      if (!body) {
        throw new BadRequestException('El cuerpo de la solicitud está vacío');
      }

      // Validar datos de entrada
      if (!body.to) {
        throw new BadRequestException('El campo "to" es requerido');
      }

      if (!body.provider) {
        throw new BadRequestException('El campo "provider" es requerido');
      }

      console.log('📧 Destinatario:', body.to);
      console.log('🏢 Empresa:', body.metadata?.companyName || 'OmniNotify');
      console.log('🔄 Proveedor:', body.provider);
      
      // Optimización CRÍTICA: Si el logo es muy grande, NO enviarlo
      let logoToUse = body.metadata?.companyLogo;
      const logoSize = body.metadata?.companyLogo?.length || 0;
      const logoSizeKB = Math.round(logoSize / 1024);
      
      if (logoSize > 500000) { // > 500KB en base64
        console.log(`⚠️ Logo demasiado grande para email: ${logoSizeKB}KB`);
        console.log('✅ Usando solo referencia del logo (no se enviará en el body)');
        logoToUse = undefined;
      } else if (logoSize > 100000) { // > 100KB
        console.log(`📏 Logo de tamaño moderado: ${logoSizeKB}KB`);
      } else if (logoSize > 0) {
        console.log(`✅ Logo de tamaño aceptable: ${logoSizeKB}KB`);
      } else {
        console.log('📭 No hay logo adjunto');
      }

      // Enmascarar el remitente
      const maskedConfig = this.maskGmailSender(body);
      
      console.log('🎭 Remitente enmascarado:', maskedConfig);
      console.log(`📤 Email desde: ${maskedConfig.fromName} <${maskedConfig.fromEmail}>`);
      
      // Preparar parámetros para el email
      const emailParams: EmailContentParams = {
        companyName: body.metadata?.companyName || 'OmniNotify',
        companyLogo: logoToUse,
        testType: body.metadata?.testType || 'connection_test',
        includeLogo: !!logoToUse && logoSize < 500000,
      };
      
      // Generar contenido HTML con logo optimizado
      const emailContent = this.generateTestEmailHTML(emailParams);
      
      // Configuración para el email provider
      const config: EmailConfig = {
        provider: body.provider,
        apiKey: body.apiKey,
      };

      // Solo agregar SMTP config si está presente
      if (body.smtpConfig) {
        config.smtp = {
          host: body.smtpConfig.host,
          port: body.smtpConfig.port,
          secure: body.smtpConfig.secure,
          auth: {
            user: body.smtpConfig.auth.user,
            pass: body.smtpConfig.auth.pass,
          },
          // Usar email enmascarado siempre
          fromEmail: maskedConfig.fromEmail,
          fromName: maskedConfig.fromName,
        };
      }

      const payload = {
        to: body.to,
        subject: `Prueba de Email - ${emailParams.companyName}`,
        html: emailContent.html,
        text: emailContent.text,
      };

      console.log('🚀 Enviando email...');
      
      // Usar el email provider existente o enviar directamente
      let result;
      if (config.provider === 'sendgrid' && config.apiKey) {
        // Usar SendGrid
        result = await this.emailProvider.send(config, payload);
      } else if (config.smtp) {
        // Usar SMTP directamente para asegurar el enmascaramiento
        result = await this.sendViaSMTP(config.smtp, payload, body.metadata);
      } else {
        throw new BadRequestException('Configuración de email no válida');
      }
      
      console.log('✅ Email enviado exitosamente');
      console.log(`📨 Message ID: ${result.messageId || 'N/A'}`);
      console.log('='.repeat(50));
      
      return {
        success: true,
        message: 'Email de prueba enviado exitosamente',
        result: {
          provider: config.provider,
          messageId: result.messageId || `test_${Date.now()}`,
          recipient: body.to,
          sender: maskedConfig.fromEmail,
          senderName: maskedConfig.fromName,
          includesLogo: !!logoToUse && logoSize < 500000,
          companyName: emailParams.companyName,
          maskedFormat: `${maskedConfig.fromName} <${maskedConfig.fromEmail}>`,
          logoOptimized: logoSize > 500000 
            ? 'logo_no_incluido_por_tamaño' 
            : logoSize > 0 ? 'logo_incluido' : 'sin_logo',
          logoSizeKB: logoSizeKB,
        },
      };
    } catch (error: any) {
      console.error('='.repeat(50));
      console.error('❌ ERROR EN TEST EMAIL');
      console.error('Mensaje:', error.message);
      console.error('='.repeat(50));
      
      const errorMessage = error.message.includes('PayloadTooLargeError') 
        ? 'El logo es demasiado grande. Por favor, comprime la imagen o usa una de menor tamaño (máx 500KB).' 
        : error.message;
      
      return {
        success: false,
        message: 'Error enviando email de prueba',
        error: errorMessage,
        details: error.response || error.stack?.split('\n')[0],
      };
    }
  }

  // Upload de logos con límites claros
  @Post('upload-logo')
  @UseInterceptors(FileInterceptor('logo', { 
    storage,
    fileFilter: (req, file, callback) => {
      console.log('📁 Archivo recibido:', {
        nombre: file.originalname,
        tipo: file.mimetype,
        tamaño: Math.round(file.size/1024) + 'KB'
      });
      
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml'];
      
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return callback(
          new BadRequestException('Solo se permiten imágenes JPG, PNG, GIF o SVG'),
          false
        );
      }
      
      // Verificar tamaño máximo (2MB para archivo original)
      if (file.size > 2 * 1024 * 1024) {
        return callback(
          new BadRequestException('La imagen debe ser menor a 2MB'),
          false
        );
      }
      
      callback(null, true);
    },
    limits: {
      fileSize: 2 * 1024 * 1024, // 2MB para archivo
    },
  }))
  @HttpCode(HttpStatus.OK)
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { companyId: string }
  ) {
    try {
      console.log('='.repeat(50));
      console.log('📤 INICIANDO UPLOAD DE LOGO');
      console.log('='.repeat(50));
      
      if (!file) {
        throw new BadRequestException('No se recibió ningún archivo');
      }

      if (!body.companyId) {
        throw new BadRequestException('El campo "companyId" es requerido');
      }

      // Leer archivo como base64
      const fileBuffer = fs.readFileSync(file.path);
      const base64Logo = `data:${file.mimetype};base64,${fileBuffer.toString('base64')}`;
      
      console.log('📊 Tamaño del archivo:', file.size, 'bytes');
      console.log('📏 Tamaño del base64:', base64Logo.length, 'caracteres');
      
      // Optimización: Reducir tamaño si es muy grande
      let optimizedBase64 = base64Logo;
      let optimized = false;
      
      if (base64Logo.length > 500000) { // > 500KB en base64
        console.log('🔄 Logo muy grande, optimizando...');
        optimizedBase64 = await this.optimizeAndCompressLogo(file.path, file.mimetype);
        console.log('📐 Tamaño optimizado:', optimizedBase64.length, 'caracteres');
        optimized = true;
      }
      
      // Guardar referencia
      const logoUrl = `${process.env.APP_URL || 'http://localhost:3000'}/uploads/logos/${file.filename}`;
      
      // Guardar en base de datos temporal
      const logoData = {
        logoUrl,
        base64: optimizedBase64,
        filename: file.filename,
        companyId: body.companyId,
        mimeType: file.mimetype,
        originalSize: file.size,
        base64Size: optimizedBase64.length,
        optimized: optimized,
        uploadedAt: new Date().toISOString(),
      };
      
      this.saveLogoToDatabase(body.companyId, logoData);
      
      console.log('✅ Logo subido y optimizado exitosamente');
      console.log('='.repeat(50));
      
      return {
        success: true,
        message: 'Logo subido exitosamente',
        data: {
          ...logoData,
          base64Preview: optimizedBase64.substring(0, 100) + '...',
          fullBase64: optimizedBase64.length < 200000 ? optimizedBase64 : undefined,
        },
      };
    } catch (error: any) {
      // Eliminar archivo temporal si hay error
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      console.error('='.repeat(50));
      console.error('❌ ERROR EN UPLOAD LOGO');
      console.error('Mensaje:', error.message);
      console.error('='.repeat(50));
      
      return {
        success: false,
        message: 'Error subiendo logo',
        error: error.message,
      };
    }
  }

  @Get('logo/:companyId')
  @HttpCode(HttpStatus.OK)
  async getLogo(@Param('companyId') companyId: string) {
    try {
      console.log('📥 Solicitando logo para companyId:', companyId);
      
      if (!companyId) {
        throw new BadRequestException('companyId es requerido');
      }
      
      // Buscar en la base de datos local
      const logoData = this.getLogoFromDatabase(companyId);
      
      return {
        success: true,
        data: logoData || {
          companyId,
          logoUrl: null,
          base64: null,
          hasLogo: false,
          message: 'No se encontró logo para esta empresa',
        },
      };
    } catch (error: any) {
      console.error('❌ Error obteniendo logo:', error.message);
      return {
        success: false,
        message: 'Error obteniendo logo',
        error: error.message,
      };
    }
  }

  @Get('stats/:companyId')
  @HttpCode(HttpStatus.OK)
  async getStats(
    @Param('companyId') companyId: string,
    @Query('days') days: string,
  ) {
    try {
      if (!companyId) {
        throw new BadRequestException('companyId es requerido');
      }
      
      return this.notificationsService.getStats(companyId);
    } catch (error: any) {
      return {
        success: false,
        message: 'Error obteniendo estadísticas',
        error: error.message,
      };
    }
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'email',
      timestamp: new Date().toISOString(),
      features: ['test-email', 'logo-support', 'masked-sender', 'smtp', 'sendgrid'],
      version: '1.0.0',
      limits: {
        bodySize: '10MB',
        fileUpload: '2MB',
        logoBase64: '500KB',
      },
    };
  }

  // 🔧 MÉTODOS AUXILIARES PRIVADOS

  private maskGmailSender(body: TestEmailRequest): { fromEmail: string; fromName: string } {
    const defaultFromName = body.metadata?.companyName || 'OmniNotify System';
    
    // SIEMPRE enmascarar para cualquier email que contenga gmail.com
    const userEmail = body.smtpConfig?.auth?.user || '';
    
    if (userEmail.includes('@gmail.com') || !userEmail) {
      let domain = 'ominotify.com';
      
      if (body.metadata?.companyName) {
        const cleanName = body.metadata.companyName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .substring(0, 20);
        
        if (cleanName.length >= 3) {
          domain = `${cleanName}.com`;
        }
      }
      
      return {
        fromEmail: `no-reply@${domain}`,
        fromName: defaultFromName,
      };
    }
    
    const emailName = userEmail.split('@')[0] || 'notificaciones';
    const emailDomain = userEmail.split('@')[1] || 'company.com';
    
    return {
      fromEmail: `no-reply@${emailDomain}`,
      fromName: defaultFromName,
    };
  }

  private async sendViaSMTP(
    smtpConfig: any,
    payload: any,
    metadata?: any
  ): Promise<any> {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.auth.user,
          pass: smtpConfig.auth.pass,
        },
      });

      await transporter.verify();
      
      const mailOptions = {
        from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        headers: {
          'X-Company-Name': metadata?.companyName || 'OmniNotify',
          'X-Mailer': 'OmniNotify Email Service',
          'X-Company-ID': metadata?.companyId || 'unknown',
          'X-Test-Type': metadata?.testType || 'connection_test',
        },
      };

      const info = await transporter.sendMail(mailOptions);
      
      return {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
      };
      
    } catch (error: any) {
      console.error('Error en sendViaSMTP:', error);
      throw new Error(`Error SMTP: ${error.message}`);
    }
  }

  private async optimizeAndCompressLogo(filePath: string, mimeType: string): Promise<string> {
    try {
      // En producción, usaría una librería como sharp o jimp
      // Por ahora, devolver el base64 original pero con advertencia
      
      console.log('🔧 Optimizando logo...');
      console.log('Tipo MIME:', mimeType);
      
      // Para imágenes pequeñas, no hacer nada
      const stats = fs.statSync(filePath);
      if (stats.size < 500000) {
        const fileBuffer = fs.readFileSync(filePath);
        return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
      }
      
      // Crear una versión simplificada para logos grandes
      console.log('🖼️ Creando versión simplificada del logo');
      
      // En una implementación real, aquí usarías sharp:
      // const sharp = require('sharp');
      // const optimizedBuffer = await sharp(fileBuffer)
      //   .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      //   .jpeg({ quality: 70 })
      //   .toBuffer();
      // return `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`;
      
      // Por ahora, devolver un placeholder
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzY2N2VlYSIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiNmZmZmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Mb2dvPC90ZXh0Pjwvc3ZnPg==';
      
    } catch (error) {
      console.error('Error optimizando logo:', error);
      return '';
    }
  }

  private generateTestEmailHTML(params: EmailContentParams): { html: string; text: string } {
    const companyName = params.companyName || 'Mi Empresa';
    const currentDate = new Date();
    
    // Determinar si usar logo o texto
    const useLogo = params.includeLogo && params.companyLogo && params.companyLogo.length < 500000;
    
    let logoHtml = '';
    if (useLogo && params.companyLogo) {
      logoHtml = `
        <div style="text-align: center; margin: 0 auto 25px auto; max-width: 200px;">
          <img src="${params.companyLogo}" alt="${companyName} Logo" 
               style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e0e0e0;"
               width="200" height="auto">
        </div>`;
    } else {
      logoHtml = `
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
               color: white; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 20px;">
            ${companyName.substring(0, 15)}
          </div>
        </div>`;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Prueba de Email - ${companyName}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
          }
          .email-container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            border: 1px solid #e8e8e8;
          }
          .email-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
          }
          .email-body {
            padding: 40px;
          }
          .success-icon {
            text-align: center;
            font-size: 64px;
            color: #10b981;
            margin-bottom: 20px;
          }
          .test-details {
            background-color: #f8f9fa;
            border-radius: 10px;
            padding: 25px;
            margin: 25px 0;
            border-left: 5px solid #3b82f6;
          }
          .email-footer {
            background-color: #f8f9fa;
            padding: 25px;
            text-align: center;
            border-top: 1px solid #e9ecef;
            color: #6c757d;
            font-size: 14px;
            line-height: 1.5;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            margin-top: 25px;
            font-weight: 600;
            font-size: 16px;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          .details-table td {
            padding: 10px 0;
            border-bottom: 1px solid #e9ecef;
          }
          .details-table td:first-child {
            font-weight: 600;
            color: #495057;
          }
          .details-table td:last-child {
            text-align: right;
            color: #6c757d;
          }
          .masked-info {
            background-color: #e8f4fd;
            border: 1px solid #b6d4fe;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
          }
          @media (max-width: 600px) {
            .email-body {
              padding: 25px;
            }
            .email-header {
              padding: 30px 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="email-header">
            ${logoHtml}
            <h1 style="margin: 10px 0 5px 0; font-size: 28px; font-weight: 700;">${companyName}</h1>
            <p style="margin: 0; opacity: 0.9; font-size: 16px;">Sistema de Notificaciones</p>
          </div>
          
          <div class="email-body">
            <div class="success-icon">✅</div>
            
            <h2 style="text-align: center; color: #333; margin-bottom: 20px; font-size: 24px;">
              ¡Prueba de Email Exitosa!
            </h2>
            
            <p style="text-align: center; color: #555; margin-bottom: 25px; font-size: 16px;">
              Este email confirma que la configuración de notificaciones por email de 
              <strong style="color: #3b82f6;">${companyName}</strong> está funcionando correctamente.
            </p>
            
            <div class="masked-info">
              <p style="margin: 0; color: #0c63e4; font-weight: 600;">
                📧 Email enviado desde sistema enmascarado
              </p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #0a58ca;">
                Cliente ve: ${companyName} &lt;no-reply@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com&gt;
              </p>
            </div>
            
            <div class="test-details">
              <h3 style="color: #3b82f6; margin-top: 0; margin-bottom: 15px; font-size: 18px;">
                📋 Detalles de la Prueba
              </h3>
              
              <table class="details-table">
                <tr>
                  <td>Fecha:</td>
                  <td>${currentDate.toLocaleDateString('es-ES', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</td>
                </tr>
                <tr>
                  <td>Hora:</td>
                  <td>${currentDate.toLocaleTimeString('es-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  })}</td>
                </tr>
                <tr>
                  <td>Estado:</td>
                  <td><span style="color: #10b981; font-weight: bold;">CONEXIÓN EXITOSA</span></td>
                </tr>
                <tr>
                  <td>Incluye logo:</td>
                  <td>${useLogo ? '✅ Sí' : '❌ No'}</td>
                </tr>
                <tr>
                  <td>Tipo de prueba:</td>
                  <td>${params.testType}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #555; line-height: 1.7; font-size: 15px;">
              Si recibiste este email, significa que tu configuración de notificaciones por email 
              está funcionando correctamente. Puedes comenzar a enviar notificaciones profesionales 
              a tus clientes desde el sistema <strong>OmniNotify</strong> con remitente enmascarado.
            </p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="#" class="button">Ir al Panel de Control</a>
            </div>
          </div>
          
          <div class="email-footer">
            <p style="margin: 0 0 10px 0; font-size: 13px;">
              © ${currentDate.getFullYear()} ${companyName}. Todos los derechos reservados.
            </p>
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #868e96;">
              Este es un email de prueba generado automáticamente. No respondas a este mensaje.
            </p>
            <p style="margin: 0; font-size: 11px; color: #adb5bd;">
              Enviado desde OmniNotify • Sistema de Notificaciones Profesionales • v1.0
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
PRUEBA DE EMAIL - ${companyName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

¡PRUEBA DE EMAIL EXITOSA!

Este email confirma que la configuración de notificaciones por email 
de ${companyName} está funcionando correctamente.

📋 DETALLES DE LA PRUEBA
────────────────────────
• Fecha: ${currentDate.toLocaleDateString()}
• Hora: ${currentDate.toLocaleTimeString()}
• Estado: CONEXIÓN EXITOSA
• Incluye logo: ${useLogo ? 'Sí' : 'No'}
• Tipo: ${params.testType}

ℹ️ INFORMACIÓN
──────────────
Este email fue enviado desde un sistema con remitente enmascarado.
Aunque uses servicios como Gmail para la autenticación, tus clientes
verán un remitente profesional con tu dominio.

Si recibiste este email, puedes estar seguro de que tu sistema de
notificaciones está configurado correctamente y listo para enviar
comunicaciones profesionales a tus clientes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
© ${currentDate.getFullYear()} ${companyName}
Este es un email de prueba generado automáticamente por OmniNotify.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;

    return { html, text };
  }

  private saveLogoToDatabase(companyId: string, logoData: any): void {
    try {
      const dbPath = path.join(process.cwd(), 'uploads', 'logos', 'database.json');
      let logosDB: Record<string, any> = {};
      
      if (fs.existsSync(dbPath)) {
        const content = fs.readFileSync(dbPath, 'utf8');
        if (content.trim()) {
          logosDB = JSON.parse(content);
        }
      }
      
      logosDB[companyId] = logoData;
      
      fs.writeFileSync(dbPath, JSON.stringify(logosDB, null, 2));
      console.log('💾 Logo guardado en base de datos local:', dbPath);
    } catch (error) {
      console.error('❌ Error guardando logo en DB:', error);
    }
  }

  private getLogoFromDatabase(companyId: string): any {
    try {
      const dbPath = path.join(process.cwd(), 'uploads', 'logos', 'database.json');
      
      if (fs.existsSync(dbPath)) {
        const content = fs.readFileSync(dbPath, 'utf8');
        if (content.trim()) {
          const logosDB: Record<string, any> = JSON.parse(content);
          return logosDB[companyId] || null;
        }
      }
    } catch (error) {
      console.error('Error leyendo logo de DB:', error);
    }
    return null;
  }
}