// ⏰ ZONA HORARIA GLOBAL
process.env.TZ = 'America/La_Paz';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as fs from 'fs';
import { json, urlencoded } from 'express';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // ✅ CORS SIMPLE PARA DOCKER
  app.enableCors({
    origin: true,
  });

  app.setGlobalPrefix('api');

  const uploadsDir = join(process.cwd(), 'uploads', 'logos');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`📁 Directorio creado: ${uploadsDir}`);
  }

  app.use('/uploads/logos', express.static(uploadsDir));

  const port = process.env.PORT ?? 3000;

  // 🔥 IMPORTANTE PARA DOCKER
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Servidor iniciado en puerto: ${port}`);
}

bootstrap();
