import { Controller, Post, Body , Param, Patch, UseGuards, Request} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createWithCompany(createUserDto);
  }
   // Nuevo endpoint: verificar email con OTP
  @Post('verify-email')
  async verifyEmail(@Body() body: { userId: string; code: string }) {
    return this.usersService.verifyEmail(body.userId, body.code);
  }

  // Reenviar código OTP
  @Post('resend-verification/:userId')
  async resendVerification(@Param('userId') userId: string) {
    return this.usersService.resendVerificationOtp(userId);
  }
  // ── Actualizar nombre (y/o datos del perfil) ──────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateProfile(
    @Param('id') id: string,
    @Body() body: { name?: string },
    @Request() req: any,
  ) {
    // Solo permite que el propio usuario edite su perfil
    if (req.user.id !== id) {
      throw new Error('No tienes permiso para editar este perfil');
    }
    return this.usersService.updateProfile(id, body);
  }
 
  // ── Cambiar contraseña ────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Patch(':id/change-password')
  async changePassword(
    @Param('id') id: string,
    @Body() body: { current_password: string; new_password: string },
    @Request() req: any,
  ) {
    if (req.user.id !== id) {
      throw new Error('No tienes permiso para cambiar esta contraseña');
    }
    return this.usersService.changePassword(id, body.current_password, body.new_password);
  }
}