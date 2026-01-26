import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 🔥 HABILITA CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8080',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Access-Control-Allow-Origin',
    ],
    credentials: false,
    maxAge: 86400,
  });
  
  // Configuración adicional
  app.setGlobalPrefix('api');
  
  // 📁 Configurar directorio para uploads
  const uploadsDir = join(process.cwd(), 'uploads', 'logos');
  
  // Crear directorio si no existe
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`📁 Directorio creado: ${uploadsDir}`);
  }
  
  // Usar express estático para servir archivos
  const express = require('express');
  app.use('/uploads/logos', express.static(uploadsDir));
  
  const port = process.env.PORT ?? 3000;
  console.log(`🚀 Servidor iniciado en: http://localhost:${port}`);
  console.log(`📁 Serviendo archivos estáticos desde: ${uploadsDir}`);
  console.log(`🌐 CORS habilitado para desarrollo`);
  
  await app.listen(port);
}

bootstrap();