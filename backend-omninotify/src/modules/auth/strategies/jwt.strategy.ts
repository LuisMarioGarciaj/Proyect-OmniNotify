import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'OMNINOTIFY_SECRET_123456',
    });
  }

  async validate(payload: any) {
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }
    console.log('🔍 JWT Payload recibido:', payload);
    return {
      id: payload.sub,
      email: payload.email,
      companyId: payload.companyId,
      role: payload.role,
    };
  }  
}