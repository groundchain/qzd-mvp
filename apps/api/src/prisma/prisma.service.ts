import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private client: PrismaClient | null = null;

  constructor(@Optional() private readonly configService?: ConfigService) {}

  private ensureClient(): PrismaClient {
    if (!this.client) {
      this.client = new PrismaClient({
        datasources: {
          db: {
            url:
              this.configService?.get<string>('DATABASE_URL') ??
              'postgresql://postgres:postgres@localhost:5432/qzd'
          }
        }
      });
    }

    return this.client;
  }

  get prisma(): PrismaClient {
    return this.ensureClient();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
      this.client = null;
    }
  }
}
