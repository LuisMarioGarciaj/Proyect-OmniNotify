// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): object {
    return { 
      status: 'OK', 
      message: 'Backend NestJS is running!',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        name: process.env.DB_NAME
      }
    };
  }

  @Get('test')
  getTest(): object {
    return {
      message: 'Test endpoint working',
      endpoints: {
        auth: '/api/auth/login (POST)',
        health: '/api/health (GET)',
        test: '/api/test (GET)'
      },
      frontend_url: 'http://localhost:5173'
    };
  }
}