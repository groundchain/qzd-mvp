import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ApiModule } from './generated/index.js';
import { apiImplementations } from './impl/index.js';

@Module({
  imports: [ApiModule.forRoot(apiImplementations)],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
