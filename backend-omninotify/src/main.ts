// ⏰ ZONA HORARIA GLOBAL
process.env.TZ = 'America/La_Paz';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import * as fs from 'fs';
import { json, urlencoded } from 'express';
import * as express from 'express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // ✅ Validation global (MUY recomendado)
  app.useGlobalPipes(new ValidationPipe());

  // ✅ CORS
  app.enableCors({
    origin: true,
  });

  app.setGlobalPrefix('api');

  // ✅ SWAGGER CONFIG
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Omninotify API')
    .setDescription('Documentación oficial de la API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, swaggerDocument);

  // Uploads folder
  const uploadsDir = join(process.cwd(), 'uploads', 'logos');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`📁 Directorio creado: ${uploadsDir}`);
  }

  app.use('/uploads/logos', express.static(uploadsDir));

  const port = process.env.PORT ?? 3000;

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Servidor iniciado en puerto: ${port}`);
  console.log(`📚 Swagger en: http://localhost:${port}/docs`);
}

bootstrap();