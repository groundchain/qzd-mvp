import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ApiModule } from '@qzd/sdk-api/server';
import { apiImplementations } from './impl/index.js';

@Module({
  imports: [ApiModule.forRoot(apiImplementations)],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
