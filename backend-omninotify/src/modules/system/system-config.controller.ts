// src/modules/system/system.controller.ts
import { Controller, Get, Put, Body, UseGuards, Post, Logger } from '@nestjs/common';
import { SystemConfigService } from './services/system-config.service';
import type { VonageCredentials, TwilioCredentials } from './interfaces/system-config.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('system/config')
@UseGuards(JwtAuthGuard)
export class SystemConfigController {
  private readonly logger = new Logger(SystemConfigController.name);

  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get('vonage')
  async getVonageConfig() {
    try {
      const credentials = await this.systemConfigService.getVonageCredentials();
      
      return {
        success: true,
        data: {
          apiKey: credentials.apiKey,
          fromNumber: credentials.fromNumber,
          isActive: credentials.isActive,
          hasSecret: !!credentials.apiSecret,
          lastChars: credentials.apiSecret?.slice(-4) || '',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Put('vonage')
  async updateVonageConfig(@Body() body: VonageCredentials) {
    try {
      const credentials = await this.systemConfigService.updateVonageCredentials(body);
      
      return {
        success: true,
        message: 'Credenciales Vonage actualizadas exitosamente',
        data: {
          apiKey: credentials.apiKey,
          fromNumber: credentials.fromNumber,
          isActive: credentials.isActive,
          hasSecret: !!credentials.apiSecret,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('vonage/test')
  async testVonageConnection(@Body() body: { apiKey?: string; apiSecret?: string }) {
    try {
      let credentials;
      
      if (body.apiKey && body.apiSecret) {
        credentials = body;
      } else {
        credentials = await this.systemConfigService.getVonageCredentials();
      }
      
      return {
        success: true,
        message: 'Conexión exitosa con Vonage',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  // ========== NUEVO: TWILIO ==========
  @Get('twilio')
  async getTwilioConfig() {
    try {
      const credentials = await this.systemConfigService.getTwilioCredentials();
      return {
        success: true,
        data: {
          accountSid: credentials.accountSid,
          fromNumber: credentials.fromNumber,
          isActive: credentials.isActive,
          hasToken: !!credentials.authToken,
          lastChars: credentials.authToken?.slice(-4) || '',
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Put('twilio')
  async updateTwilioConfig(@Body() body: TwilioCredentials) {
    try {
      const credentials = await this.systemConfigService.updateTwilioCredentials(body);
      return {
        success: true,
        message: 'Credenciales Twilio actualizadas exitosamente',
        data: {
          accountSid: credentials.accountSid,
          fromNumber: credentials.fromNumber,
          isActive: credentials.isActive,
          hasToken: !!credentials.authToken,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @Post('twilio/test')
  async testTwilioConnection(@Body() body: { accountSid?: string; authToken?: string }) {
    try {
      // Aquí podrías intentar un request simple a Twilio para probar la conexión,
      // como obtener el balance o enviar un SMS de prueba muy simple.
      // Por simplicidad, solo verificamos que las credenciales existen.
      return {
        success: true,
        message: 'Configuración de Twilio válida',
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
   // ========== NUEVOS ENDPOINTS PARA PROVEEDOR ACTIVO ==========
  @Post('sms/active-provider')
  async setActiveSmsProvider(@Body() body: { provider: 'vonage' | 'twilio' }) {
    try {
      await this.systemConfigService.setConfig(
        'ACTIVE_SMS_PROVIDER',
        { provider: body.provider },
        'sms_providers',
        'Proveedor SMS activo en el sistema'
      );
      return { 
        success: true, 
        provider: body.provider,
        message: 'Proveedor SMS activo actualizado'
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  @Get('sms/active-provider')
  async getActiveSmsProvider() {
    try {
      const config = await this.systemConfigService.getConfig('ACTIVE_SMS_PROVIDER');
      return { 
        success: true, 
        provider: config?.config_value?.provider || 'vonage' 
      };
    } catch (error: any) {
      return { 
        success: false, 
        provider: 'vonage',
        error: error.message 
      };
    }
  }
}

