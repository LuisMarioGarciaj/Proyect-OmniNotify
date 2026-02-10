// src/modules/users/users.service.ts
import { Injectable, Logger, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from './entities/user.entity';
import { Company, CompanyStatus } from '../companies/entities/company.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {
    this.testConnection();
  }

  async testConnection() {
    try {
      const count = await this.userRepo.count();
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
      // 1. Crear la Compañía
      const companyId = uuidv4();
      
      // Creamos el objeto usando la clase para que tome los defaults
      const companyInstance = queryRunner.manager.create(Company, {
        id: companyId,
        name: `Empresa de ${name}`,
        status: CompanyStatus.ACTIVE,
        // Usamos "as any" para evitar que el modo estricto moleste con el null/undefined
        logo: null as any, 
        api_keys_config: null as any
      });

      await queryRunner.manager.save(companyInstance);

      // 2. Crear el Usuario
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const userInstance = queryRunner.manager.create(User, {
        id: uuidv4(),
        company_id: companyId,
        name,
        email,
        password: hashedPassword,
        role: role || 'OPERATOR',
        status: 'ACTIVE'
      });

      const savedUser = await queryRunner.manager.save(userInstance);
      
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
    if (!storedPassword.startsWith('$2b$') && !storedPassword.startsWith('$2a$')) {
        return password === storedPassword;
    }
    return await bcrypt.compare(password, storedPassword);
  }
}