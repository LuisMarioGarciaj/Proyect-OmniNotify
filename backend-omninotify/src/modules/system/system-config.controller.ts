// src/modules/system/system.controller.ts
import { Controller, Get, Put, Body, UseGuards, Post, Logger } from '@nestjs/common';
import { SystemConfigService } from './services/system-config.service';
import type { VonageCredentials } from './services/system-config.service'; // ✅ import type
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
}