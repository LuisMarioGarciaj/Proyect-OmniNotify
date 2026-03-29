// src/modules/users/users.service.ts   v
import {
  Injectable,

  Logger,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from './entities/user.entity';
import { Company, CompanyStatus } from '../companies/entities/company.entity';
import { CompanyProviderConfig } from '../providers/entities/company-provider-config.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { OtpService } from '../auth/otp.service'; // Importar OtpService

const NEXO_WHATSAPP_PROVIDER_ID = 1;
const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(CompanyProviderConfig)
    private readonly providerConfigRepo: Repository<CompanyProviderConfig>,

    private readonly dataSource: DataSource,
    private readonly otpService: OtpService, // Inyectar OtpService
  ) {}

  async testConnection() {
    try {
      await this.userRepo.count();
      this.logger.log(`✅ CONEXIÓN EXITOSA con la base de datos`);
    } catch (error) {
      this.logger.error(`❌ ERROR de conexión a la BD: ${error.message}`);
    }
  }

  async createWithCompany(createUserDto: CreateUserDto) {
    const { email, password, name, role } = createUserDto;

    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ── 1. Crear la Empresa ──────────────────────────────────────────────
      const companyId = uuidv4();

      const companyInstance = queryRunner.manager.create(Company, {
        id: companyId,
        name: `Empresa de ${name}`,
        status: CompanyStatus.ACTIVE,
        logo: null as any,
        api_keys_config: null as any,
      });

      await queryRunner.manager.save(companyInstance);

      // ── 2. Crear el Usuario (INACTIVO hasta verificar email) ──────────────────
      const hashedPassword = await bcrypt.hash(password, 10);

      const userInstance = queryRunner.manager.create(User, {
        id: uuidv4(),
        company_id: companyId,
        name,
        email,
        password: hashedPassword,
        role: role || 'OPERATOR',
        status: 'PENDING_VERIFICATION', // 🔥 Cambiar: PENDING_VERIFICATION en lugar de ACTIVE
        is_first_login: true,
      });

      const savedUser = await queryRunner.manager.save(userInstance);

      // ── 3. Crear la config de Nexo WhatsApp para esta empresa ──
      const providerConfig = queryRunner.manager.create(CompanyProviderConfig, {
        id: uuidv4(),
        companyId: companyId,
        providerId: NEXO_WHATSAPP_PROVIDER_ID,
        config: {
          token:
            process.env.NEXO_API_TOKEN ||
            '15c461b4-76ac-4c71-ac98-975901a98efb',
          status: 'ACTIVE',
          environment: 'production',
          configuredAt: new Date().toISOString(),
          configuredBy: email,
        },
      });

      await queryRunner.manager.save(providerConfig);

      this.logger.log(
        `✅ Registro completo: empresa ${companyId} + usuario ${savedUser.id} (PENDING_VERIFICATION)`,
      );

      await queryRunner.commitTransaction();

      // ── 4. Enviar OTP de verificación (después de commit) ──────────────────
      const smtpConfigured = !!(
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
      );

      if (smtpConfigured) {
        const code = this.otpService.generateCode();
        await this.otpService.saveOtp(savedUser.id, code);
        await this.otpService.sendVerificationEmail(email, name, code);
        this.logger.log(`📧 OTP de verificación enviado a ${email}`);
      } else {
        this.logger.warn(`⚠️ SMTP no configurado - usuario ${email} creado sin verificación`);
        // Si no hay SMTP, activar automáticamente (para desarrollo)
        await this.userRepo.update(savedUser.id, { status: 'ACTIVE' });
      }

      const { password: _, ...result } = savedUser;
      return {
        ...result,
        requires_verification: smtpConfigured, // Indicar si requiere verificación
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error en registro: ${error.message}`);
      throw new InternalServerErrorException('Error al procesar el registro');
    } finally {
      await queryRunner.release();
    }
  }

  // Nuevo método: verificar email con OTP
  async verifyEmail(userId: string, code: string): Promise<{ success: boolean; message: string }> {
    const isValid = await this.otpService.verifyOtp(userId, code);
    
    if (!isValid) {
      throw new BadRequestException('Código inválido o expirado');
    }

    const user = await this.findById(userId);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.status === 'ACTIVE') {
      return { success: true, message: 'Cuenta ya verificada' };
    }

    // Activar la cuenta
    await this.userRepo.update(userId, { status: 'ACTIVE' });
    this.logger.log(`✅ Usuario ${userId} verificado y activado`);

    return { success: true, message: 'Cuenta verificada exitosamente' };
  }

  // Resend OTP
  async resendVerificationOtp(userId: string): Promise<{ message: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.status === 'ACTIVE') {
      throw new BadRequestException('La cuenta ya está activa');
    }

    const smtpConfigured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    );

    if (!smtpConfigured) {
      throw new BadRequestException('Servicio de email no disponible');
    }

    const code = this.otpService.generateCode();
    await this.otpService.saveOtp(userId, code);
    await this.otpService.sendVerificationEmail(user.email, user.name, code);

    return { message: 'Nuevo código enviado a tu correo' };
  }

  async findByEmail(email: string) {
    return await this.userRepo.findOne({ where: { email } });
  }

  async validatePassword(password: string, storedPassword: string) {
    if (
      !storedPassword.startsWith('$2b$') &&
      !storedPassword.startsWith('$2a$')
    ) {
      return password === storedPassword;
    }
    return await bcrypt.compare(password, storedPassword);
  }

  async findById(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async markFirstLoginDone(userId: string): Promise<void> {
    await this.userRepo.update(userId, { is_first_login: false });
  }
  // ── Actualizar perfil (nombre) ────────────────────────────────────────────
  async updateProfile(userId: string, data: { name?: string }): Promise<{ success: boolean; message: string; user: Partial<User> }> {
    const user = await this.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado');
 
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
 
      if (!trimmed) {
        throw new BadRequestException('El nombre no puede estar vacío');
      }
      if (trimmed.length < 2) {
        throw new BadRequestException('El nombre debe tener al menos 2 caracteres');
      }
      if (trimmed.length > 80) {
        throw new BadRequestException('El nombre no puede superar 80 caracteres');
      }
      if (!NAME_REGEX.test(trimmed)) {
        throw new BadRequestException(
          'El nombre solo puede contener letras y espacios (sin números ni caracteres especiales)',
        );
      }
 
      await this.userRepo.update(userId, { name: trimmed });
      this.logger.log(`✅ Nombre actualizado para usuario ${userId}: "${trimmed}"`);
    }
 
    const updated = await this.findById(userId);
    const { password: _, ...safeUser } = updated as any;
 
    return {
      success: true,
      message: 'Perfil actualizado correctamente',
      user: safeUser,
    };
  }
   // ── Cambiar contraseña ────────────────────────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.findById(userId);
    if (!user) throw new BadRequestException('Usuario no encontrado');
 
    // Validar contraseña actual
    const isCurrentValid = await this.validatePassword(currentPassword, user.password);
    if (!isCurrentValid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }
 
    // Validar que la nueva no sea igual a la actual
    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }
 
    // Validar longitud mínima
    if (newPassword.length < 6) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');
    }
 
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(userId, { password: hashedPassword });
    this.logger.log(`✅ Contraseña actualizada para usuario ${userId}`);
 
    return { success: true, message: 'Contraseña actualizada correctamente' };
  }

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.userRepo.update(userId, { password: hashedPassword });
  }

}