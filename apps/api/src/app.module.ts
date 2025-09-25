import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { AccountsModule } from './accounts/accounts.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { RemittanceModule } from './remittance/remittance.module.js';
import { AdminModule } from './admin/admin.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ErrorMapperFilter } from './common/filters/error-mapper.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  translateTime: 'SYS:standard',
                  singleLine: false
                }
              }
            : undefined
      }
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 30
      }
    ]),
    PrismaModule,
    AuthModule,
    AccountsModule,
    LedgerModule,
    RemittanceModule,
    AdminModule,
    HealthModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_FILTER,
      useClass: ErrorMapperFilter
    }
  ]
})
export class AppModule {}
