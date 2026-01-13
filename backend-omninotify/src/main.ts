import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 🔥 HABILITA CORS - Esto es CRÍTICO para que funcione tu frontend
  app.enableCors({
    origin: [
      'http://localhost:3000',    // Tu backend
      'http://localhost:5173',    // Vite (puerto común)
      'http://localhost:5174',    // Otro puerto de Vite
      'http://localhost:8080',    // Otro puerto común
      'http://localhost:3001',    // Create React App
      'http://localhost:3002',    // Otro puerto React
      'http://localhost:3003',    // Otro puerto React
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Access-Control-Allow-Origin',
    ],
    credentials: false,  // Cambia a true si usas cookies/sesiones
    maxAge: 86400, // 24 horas
  });
  
  // Configuración adicional
  app.setGlobalPrefix('api'); // Opcional: añade /api a todas las rutas
  
  const port = process.env.PORT ?? 3000;
  console.log(`🚀 Servidor iniciado en: http://localhost:${port}`);
  console.log(`🌐 CORS habilitado para desarrollo`);
  
  await app.listen(port);
}

bootstrap();