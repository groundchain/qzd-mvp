import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception during bootstrap', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection during bootstrap', reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap().catch((error) => {
  console.error('Failed to start API', error);
  process.exitCode = 1;
});
