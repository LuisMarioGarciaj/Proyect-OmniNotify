import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { CompaniesModule } from '../companies/companies.module'; // <-- IMPORTAR
import { OtpService } from './otp.service';
import { OtpToken } from './entities/otp-token.entity';
import { ResetPasswordToken } from './entities/reset-token.entity'; 
import { ResetPasswordService } from './reset-password.service';

@Module({
  imports: [
    UsersModule,
    CompaniesModule,
    PassportModule,
    TypeOrmModule.forFeature([OtpToken,ResetPasswordToken]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'OMNINOTIFY_SECRET_123456',
      signOptions: {
        expiresIn: '90m', 
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OtpService,ResetPasswordService], 
  exports: [JwtStrategy],
})
export class AuthModule {}