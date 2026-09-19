import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Dokumen pendukung proyek — disimpan di disk lokal (uploads/), disajikan
  // statis di /uploads/... . Lihat proyek.controller.ts untuk endpoint upload.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Naikkan limit body parser — diperlukan untuk payload besar (import Excel, resolusi massal)
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  const config = new DocumentBuilder()
    .setTitle('ePerencanaan API')
    .setDescription('Dokumentasi REST API sistem e-Perencanaan')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3010;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server berjalan di http://localhost:${port}`);
  console.log(`📖 Swagger docs di http://localhost:${port}/api-docs`);
}
bootstrap();
