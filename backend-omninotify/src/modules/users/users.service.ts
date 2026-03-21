// src/modules/users/users.service.ts
import {
  Injectable,
  Logger,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from './entities/user.entity';
import { Company, CompanyStatus } from '../companies/entities/company.entity';
import { CompanyProviderConfig } from '../providers/entities/company-provider-config.entity';
import { CreateUserDto } from './dto/create-user.dto';

// provider_id = 1 → NEXO_WHATSAPP (igual que en companies.service.ts)
const NEXO_WHATSAPP_PROVIDER_ID = 1;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    // ✅ Necesario para que TypeORM registre CompanyProviderConfig en el módulo
    // (la inserción real se hace via queryRunner.manager dentro de la transacción)
    @InjectRepository(CompanyProviderConfig)
    private readonly providerConfigRepo: Repository<CompanyProviderConfig>,

    private readonly dataSource: DataSource,
  ) {
    this.testConnection();
  }

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

      // ── 2. Crear el Usuario ──────────────────────────────────────────────
      const hashedPassword = await bcrypt.hash(password, 10);

      const userInstance = queryRunner.manager.create(User, {
        id: uuidv4(),
        company_id: companyId,
        name,
        email,
        password: hashedPassword,
        role: role || 'OPERATOR',
        status: 'ACTIVE',
      });

      const savedUser = await queryRunner.manager.save(userInstance);

      // ── 3. Crear la config de Nexo WhatsApp para esta empresa ──
      // Todas las empresas usan el mismo token de Nexo (puede sobreescribirse desde Settings).

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
        `✅ Registro completo: empresa ${companyId} + usuario ${savedUser.id} + config Nexo creada`,
      );

      await queryRunner.commitTransaction();

      const { password: _, ...result } = savedUser;
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Error en registro: ${error.message}`);
      throw new InternalServerErrorException('Error al procesar el registro');
    } finally {
      await queryRunner.release();
    }
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
}
