// src/modules/system/services/system-config.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../entities/system-config.entity';
// Importamos las interfaces
import { VonageCredentials, TwilioCredentials } from '../interfaces/system-config.interface'; // Ajusta la ruta

@Injectable()
export class SystemConfigService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigService.name);
  
  // Cache para Vonage
  private cachedVonageConfig: VonageCredentials | null = null;
  // Cache para Twilio
  private cachedTwilioConfig: TwilioCredentials | null = null;
  
  private lastCacheUpdate: Date | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(
    @InjectRepository(SystemConfig)
    private systemConfigRepository: Repository<SystemConfig>,
  ) {}

  async onModuleInit() {
    // Cargar configuraciones al iniciar
    await this.loadVonageConfig();
    await this.loadTwilioConfig(); // <--- NUEVO
  }

  // ==================== VONAGE (Código existente, ligeramente mejorado) ====================
  async getVonageCredentials(forceRefresh = false): Promise<VonageCredentials> {
    if (forceRefresh || !this.cachedVonageConfig || !this.lastCacheUpdate || (Date.now() - this.lastCacheUpdate.getTime() > this.CACHE_TTL)) {
      await this.loadVonageConfig();
    }

    if (!this.cachedVonageConfig) {
      this.logger.error('❌ Credenciales de Vonage no encontradas en System_Config');
      throw new Error('Vonage credentials not configured in System_Config');
    }

    if (!this.cachedVonageConfig.isActive) {
      this.logger.warn('⚠️ Las credenciales de Vonage están desactivadas');
      throw new Error('Vonage service is inactive');
    }

    return this.cachedVonageConfig;
  }

  private async loadVonageConfig(): Promise<void> {
    try {
      const config = await this.systemConfigRepository.findOne({
        where: { config_key: 'VONAGE_CREDENTIALS' }
      });

      if (config?.config_value) {
        this.cachedVonageConfig = {
          apiKey: config.config_value.apiKey,
          apiSecret: config.config_value.apiSecret,
          fromNumber: config.config_value.fromNumber || 'OmniNotify',
          isActive: config.config_value.isActive !== false,
        };
        this.logger.log('✅ Credenciales Vonage cargadas desde BD');
      } else {
        this.cachedVonageConfig = null;
        this.logger.warn('⚠️ No hay credenciales de Vonage en BD');
      }
      this.lastCacheUpdate = new Date();
    } catch (error: any) {
      this.logger.error(`Error cargando configuración Vonage: ${error.message}`);
      throw error;
    }
  }

  async updateVonageCredentials(credentials: Partial<VonageCredentials>): Promise<VonageCredentials> {
    // ... (tu código existente, funcionará igual) ...
    try {
        let config = await this.systemConfigRepository.findOne({
          where: { config_key: 'VONAGE_CREDENTIALS' }
        });
  
        if (!config) {
          config = this.systemConfigRepository.create({
            config_key: 'VONAGE_CREDENTIALS',
            category: 'sms_providers',
          });
        }
  
        config.config_value = {
          apiKey: credentials.apiKey ?? config.config_value?.apiKey ?? '',
          apiSecret: credentials.apiSecret ?? config.config_value?.apiSecret ?? '',
          fromNumber: credentials.fromNumber ?? config.config_value?.fromNumber ?? 'OmniNotify',
          isActive: credentials.isActive ?? config.config_value?.isActive ?? true,
        };
  
        await this.systemConfigRepository.save(config);
        await this.loadVonageConfig(); // Recargar caché
        
        return this.cachedVonageConfig!;
      } catch (error: any) {
        this.logger.error(`Error actualizando credenciales Vonage: ${error.message}`);
        throw error;
      }
  }

  // ==================== NUEVO: TWILIO ====================
  async getTwilioCredentials(forceRefresh = false): Promise<TwilioCredentials> {
    if (forceRefresh || !this.cachedTwilioConfig || !this.lastCacheUpdate || (Date.now() - this.lastCacheUpdate.getTime() > this.CACHE_TTL)) {
      await this.loadTwilioConfig();
    }

    if (!this.cachedTwilioConfig) {
      this.logger.error('❌ Credenciales de Twilio no encontradas en System_Config');
      throw new Error('Twilio credentials not configured in System_Config');
    }

    if (!this.cachedTwilioConfig.isActive) {
      this.logger.warn('⚠️ Las credenciales de Twilio están desactivadas');
      throw new Error('Twilio service is inactive');
    }

    return this.cachedTwilioConfig;
  }

  private async loadTwilioConfig(): Promise<void> {
    try {
      const config = await this.systemConfigRepository.findOne({
        where: { config_key: 'TWILIO_CREDENTIALS' }
      });

      if (config?.config_value) {
        this.cachedTwilioConfig = {
          accountSid: config.config_value.accountSid,
          authToken: config.config_value.authToken,
          fromNumber: config.config_value.fromNumber,
          isActive: config.config_value.isActive !== false,
        };
        this.logger.log('✅ Credenciales Twilio cargadas desde BD');
      } else {
        this.cachedTwilioConfig = null;
        this.logger.warn('⚠️ No hay credenciales de Twilio en BD');
      }
      this.lastCacheUpdate = new Date();
    } catch (error: any) {
      this.logger.error(`Error cargando configuración Twilio: ${error.message}`);
      throw error;
    }
  }

  async updateTwilioCredentials(credentials: Partial<TwilioCredentials>): Promise<TwilioCredentials> {
    try {
      let config = await this.systemConfigRepository.findOne({
        where: { config_key: 'TWILIO_CREDENTIALS' }
      });

      if (!config) {
        config = this.systemConfigRepository.create({
          config_key: 'TWILIO_CREDENTIALS',
          category: 'sms_providers',
          description: 'Credenciales globales de Twilio para envío de SMS',
        });
      }

      config.config_value = {
        accountSid: credentials.accountSid ?? config.config_value?.accountSid ?? '',
        authToken: credentials.authToken ?? config.config_value?.authToken ?? '',
        fromNumber: credentials.fromNumber ?? config.config_value?.fromNumber ?? '',
        isActive: credentials.isActive ?? config.config_value?.isActive ?? true,
      };

      await this.systemConfigRepository.save(config);
      await this.loadTwilioConfig(); // Recargar caché
      
      return this.cachedTwilioConfig!;
    } catch (error: any) {
      this.logger.error(`Error actualizando credenciales Twilio: ${error.message}`);
      throw error;
    }
  }

  // ==================== MÉTODOS GENERALES ====================
  async getConfig(key: string): Promise<SystemConfig | null> {
    return this.systemConfigRepository.findOne({ where: { config_key: key } });
  }

  async setConfig(key: string, value: Record<string, any>, category?: string, description?: string): Promise<SystemConfig> {
    // ... (tu código existente) ...
    let config = await this.systemConfigRepository.findOne({ where: { config_key: key } });
    if (!config) {
      config = this.systemConfigRepository.create({ config_key: key, config_value: value, category: category || 'general', description: description || '' });
    } else {
      config.config_value = value;
      if (category) config.category = category;
      if (description) config.description = description;
    }
    return this.systemConfigRepository.save(config);
  }

  clearCache(): void {
    this.cachedVonageConfig = null;
    this.cachedTwilioConfig = null; // <--- Limpiar también Twilio
    this.lastCacheUpdate = null;
    this.logger.log('🧹 Caché de configuración limpiada');
  }
}