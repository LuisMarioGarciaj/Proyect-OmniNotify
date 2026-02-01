// ⏰ ZONA HORARIA GLOBAL (DEBE IR PRIMERO)
process.env.TZ = 'America/La_Paz';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as fs from 'fs';
import { json, urlencoded } from 'express';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔥 AUMENTAR LÍMITES DE BODY A 10MB PARA LOGOS
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // 🌐 HABILITAR CORS
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

  // 🌍 Prefijo global
  app.setGlobalPrefix('api');

  // 📁 Configurar directorio para uploads
  const uploadsDir = join(process.cwd(), 'uploads', 'logos');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`📁 Directorio creado: ${uploadsDir}`);
  }

  // 📦 Servir archivos estáticos
  app.use('/uploads/logos', express.static(uploadsDir));

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  console.log(`🚀 Servidor iniciado en: http://localhost:${port}`);
  console.log(`📁 Archivos estáticos: /uploads/logos`);
  console.log(`🌐 CORS habilitado`);
  console.log(`📏 Límite body: 10MB`);
  console.log(`⏰ Zona horaria: ${process.env.TZ}`);
}

bootstrap();
