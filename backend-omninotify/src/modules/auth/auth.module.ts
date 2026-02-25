import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { CompaniesModule } from '../companies/companies.module'; // <-- IMPORTAR

@Module({
  imports: [
    UsersModule,
    CompaniesModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'OMNINOTIFY_SECRET_123456',
      signOptions: {
        expiresIn: '90m', 
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy], 
  exports: [JwtStrategy],
})
export class AuthModule {}