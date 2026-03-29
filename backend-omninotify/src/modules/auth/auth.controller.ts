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
   // 👇 NUEVOS ENDPOINTS
  @Post('forgot-password')
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('validate-reset-token')
  validateResetToken(@Body() body: { token: string }) {
    return this.authService.validateResetToken(body.token);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { token: string; new_password: string }) {
    return this.authService.resetPassword(body.token, body.new_password);
  }
}
