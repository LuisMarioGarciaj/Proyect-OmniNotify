// src/modules/users/users.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    this.testConnection();
  }

  async testConnection() {
    try {
      const count = await this.userRepo.count();
      this.logger.log(`✅ CONEXIÓN EXITOSA con la base de datos`);
      this.logger.log(`📊 Total de usuarios encontrados: ${count}`);
      
      if (count > 0) {
        const users = await this.userRepo.find({
          select: ['id', 'email', 'name', 'role', 'status'],
          take: 5, // Muestra solo los primeros 5
        });
        this.logger.log(`👥 Primeros usuarios:`);
        users.forEach(user => {
          this.logger.log(`   - ${user.email} (${user.name}) [${user.role}]`);
        });
      }
    } catch (error) {
      this.logger.error(`❌ ERROR de conexión a la BD: ${error.message}`);
    }
  }

  async findByEmail(email: string) {
    this.logger.log(`🔍 Buscando usuario con email: ${email}`);
    const user = await this.userRepo.findOne({
      where: { email },
    });
    
    if (user) {
      this.logger.log(`✅ Usuario encontrado: ${user.name} (${user.email})`);
    } else {
      this.logger.warn(`⚠️ Usuario NO encontrado con email: ${email}`);
    }
    
    return user;
  }

  // src/modules/users/users.service.ts
async validatePassword(password: string, storedPassword: string) {
    this.logger.log(`🔐 Validando contraseña...`);
    this.logger.log(`🔐 Contraseña recibida: ${password}`);
    this.logger.log(`🔐 Contraseña almacenada (primeros 10 chars): ${storedPassword.substring(0, 10)}...`);
    
    // Si la contraseña almacenada NO está hasheada (no empieza con $2b$)
    if (!storedPassword.startsWith('$2b$') && !storedPassword.startsWith('$2a$')) {
        this.logger.log(`🔐 Contraseña en texto plano detectada, comparando directamente`);
        // Comparación directa (para desarrollo)
        const isValid = password === storedPassword;
        this.logger.log(`🔐 Validación: ${isValid ? '✅ CORRECTA' : '❌ INCORRECTA'}`);
        return isValid;
    }
    
    // Si está hasheada, usa bcrypt
    this.logger.log(`🔐 Contraseña hasheada detectada, usando bcrypt`);
    const isValid = await bcrypt.compare(password, storedPassword);
    this.logger.log(`🔐 Validación bcrypt: ${isValid ? '✅ CORRECTA' : '❌ INCORRECTA'}`);
    return isValid;
}
}