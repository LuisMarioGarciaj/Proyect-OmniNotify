import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }
   @Post('verify-otp')
  verifyOtp(@Body() body: { user_id: string; code: string }) {
    return this.authService.verifyOtp(body.user_id, body.code);
  }
}
