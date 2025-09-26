import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ApiModule } from '@qzd/sdk-api/server';
import { apiImplementations } from './impl/index.js';
import { InMemoryBankService } from './in-memory-bank.service.js';
import './register-generated-metadata.js';

@Module({
  imports: [ApiModule.forRoot(apiImplementations)],
  controllers: [AppController],
  providers: [AppService, InMemoryBankService]
})
export class AppModule {}
