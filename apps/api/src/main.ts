import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { initializeTracing, shutdownTracing } from './observability/tracing.js';

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception during bootstrap', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection during bootstrap', reason);
});

async function bootstrap() {
  await initializeTracing();
  const app = await NestFactory.create(AppModule);
  const corsOriginsEnv = process.env.CORS_ORIGIN;
  const corsOrigins = corsOriginsEnv
    ? corsOriginsEnv.split(',').map((origin) => origin.trim()).filter(Boolean)
    : undefined;

  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : true,
  });
  await app.listen(3000);

  const handleShutdown = async () => {
    try {
      await app.close();
    } catch (error) {
      console.error('Failed to gracefully close the Nest application', error);
    } finally {
      await shutdownTracing();
    }
  };

  process.once('SIGTERM', handleShutdown);
  process.once('SIGINT', handleShutdown);
}

bootstrap().catch((error) => {
  console.error('Failed to start API', error);
  process.exitCode = 1;
});
