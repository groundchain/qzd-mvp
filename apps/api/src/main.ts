import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { patchNestJsSwagger } from 'nestjs-zod';
import { AppModule } from './app.module.js';

async function bootstrap() {
  patchNestJsSwagger();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('QZD API')
    .setDescription('API skeleton for QZD ledger and remittance services.')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

bootstrap();
