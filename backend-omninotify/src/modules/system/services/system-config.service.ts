// src/modules/system/system-config.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../entities/system-config.entity';

export interface VonageCredentials {
  apiKey: string;
  apiSecret: string;
  fromNumber: string;
  isActive: boolean;
}

@Injectable()
export class SystemConfigService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigService.name);
  private cachedVonageConfig: VonageCredentials | null = null;
  private lastCacheUpdate: Date | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(
    @InjectRepository(SystemConfig)
    private systemConfigRepository: Repository<SystemConfig>,
  ) {}

  async onModuleInit() {
    // Cargar configuración al iniciar el módulo
    await this.loadVonageConfig();
  }

  /**
   * Obtiene las credenciales de Vonage desde la base de datos
   * Con caché para evitar consultas repetitivas
   */
  async getVonageCredentials(forceRefresh = false): Promise<VonageCredentials> {
    // Si no hay caché o está expirada o se fuerza refresh, consultar BD
    if (forceRefresh || 
        !this.cachedVonageConfig || 
        !this.lastCacheUpdate || 
        (Date.now() - this.lastCacheUpdate.getTime() > this.CACHE_TTL)) {
      
      await this.loadVonageConfig();
    }

    if (!this.cachedVonageConfig) {
      this.logger.error('❌ No se encontraron credenciales de Vonage en System_Config');
      throw new Error('Vonage credentials not configured in System_Config');
    }

    if (!this.cachedVonageConfig.isActive) {
      this.logger.warn('⚠️ Las credenciales de Vonage están desactivadas');
      throw new Error('Vonage service is inactive');
    }

    return this.cachedVonageConfig;
  }

  /**
   * Carga la configuración de Vonage desde la base de datos
   */
  private async loadVonageConfig(): Promise<void> {
    try {
      const config = await this.systemConfigRepository.findOne({
        where: { config_key: 'VONAGE_CREDENTIALS' }
      });

      if (config) {
        this.cachedVonageConfig = {
          apiKey: config.config_value.apiKey,
          apiSecret: config.config_value.apiSecret,
          fromNumber: config.config_value.fromNumber || 'OmniNotify',
          isActive: config.config_value.isActive !== false, // default true
        };
        this.lastCacheUpdate = new Date();
        
        this.logger.log('✅ Credenciales Vonage cargadas desde BD');
        this.logger.debug(`API Key: ${this.cachedVonageConfig.apiKey.substring(0, 4)}...`);
      } else {
        // Crear configuración por defecto si no existe
        // await this.createDefaultVonageConfig();
        await this.loadVonageConfig(); // Recargar después de crear
      }
    } catch (error: any) {
      this.logger.error(`Error cargando configuración Vonage: ${error.message}`);
      throw error;
    }
  }

  /**
   * Crea la configuración por defecto de Vonage si no existe
   */
//   private async createDefaultVonageConfig(): Promise<void> {
//     const defaultConfig = this.systemConfigRepository.create({
//       config_key: 'VONAGE_CREDENTIALS',
//       config_value: {
//         apiKey: '84a24d93',
//         apiSecret: '46Xump31CGyK88hf',
//         fromNumber: 'OmniNotify',
//         isActive: true,
//       },
//       category: 'sms_providers',
//       description: 'Credenciales globales de Vonage para envío de SMS',
//     });

//     await this.systemConfigRepository.save(defaultConfig);
//     this.logger.log('✅ Configuración por defecto de Vonage creada');
//   }

  /**
   * Actualiza las credenciales de Vonage
   */
  async updateVonageCredentials(credentials: Partial<VonageCredentials>): Promise<VonageCredentials> {
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

      // Actualizar valores
      config.config_value = {
        apiKey: credentials.apiKey ?? config.config_value?.apiKey ?? '',
        apiSecret: credentials.apiSecret ?? config.config_value?.apiSecret ?? '',
        fromNumber: credentials.fromNumber ?? config.config_value?.fromNumber ?? 'OmniNotify',
        isActive: credentials.isActive ?? config.config_value?.isActive ?? true,
      };

      await this.systemConfigRepository.save(config);
      
      // Actualizar caché
      await this.loadVonageConfig();
      
      this.logger.log('✅ Credenciales Vonage actualizadas en BD');
      
      return this.cachedVonageConfig!;
    } catch (error: any) {
      this.logger.error(`Error actualizando credenciales Vonage: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene configuración por clave
   */
  async getConfig(key: string): Promise<SystemConfig | null> {
    return this.systemConfigRepository.findOne({
      where: { config_key: key }
    });
  }

  /**
   * Actualiza o crea una configuración
   */
  async setConfig(key: string, value: Record<string, any>, category?: string, description?: string): Promise<SystemConfig> {
    let config = await this.systemConfigRepository.findOne({
      where: { config_key: key }
    });

    if (!config) {
      config = this.systemConfigRepository.create({
        config_key: key,
        config_value: value,
        category: category || 'general',
        description: description || '',
      });
    } else {
      config.config_value = value;
      if (category) config.category = category;
      if (description) config.description = description;
    }

    return this.systemConfigRepository.save(config);
  }

  /**
   * Limpia la caché forzando recarga en próxima consulta
   */
  clearCache(): void {
    this.cachedVonageConfig = null;
    this.lastCacheUpdate = null;
    this.logger.log('🧹 Caché de configuración limpiada');
  }
}