import { Controller, Post, Body , Param} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

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
}