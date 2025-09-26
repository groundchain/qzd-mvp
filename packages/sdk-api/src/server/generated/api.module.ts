import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ApiImplementations } from './api-implementations.js';
import { AccountsApi } from './api/index.js';
import { AccountsApiController } from './controllers/index.js';
import { AdminApi } from './api/index.js';
import { AdminApiController } from './controllers/index.js';
import { AuthApi } from './api/index.js';
import { AuthApiController } from './controllers/index.js';
import { HealthApi } from './api/index.js';
import { HealthApiController } from './controllers/index.js';
import { LedgerApi } from './api/index.js';
import { LedgerApiController } from './controllers/index.js';
import { RemittancesApi } from './api/index.js';
import { RemittancesApiController } from './controllers/index.js';
import { TransactionsApi } from './api/index.js';
import { TransactionsApiController } from './controllers/index.js';

@Module({})
export class ApiModule {
  static forRoot(apiImplementations: ApiImplementations): DynamicModule {
      const providers: Provider[] = [
        {
          provide: AccountsApi,
          useClass: apiImplementations.accountsApi
        },
        {
          provide: AdminApi,
          useClass: apiImplementations.adminApi
        },
        {
          provide: AuthApi,
          useClass: apiImplementations.authApi
        },
        {
          provide: HealthApi,
          useClass: apiImplementations.healthApi
        },
        {
          provide: LedgerApi,
          useClass: apiImplementations.ledgerApi
        },
        {
          provide: RemittancesApi,
          useClass: apiImplementations.remittancesApi
        },
        {
          provide: TransactionsApi,
          useClass: apiImplementations.transactionsApi
        },
      ];

      return {
        module: ApiModule,
        controllers: [
          AccountsApiController,
          AdminApiController,
          AuthApiController,
          HealthApiController,
          LedgerApiController,
          RemittancesApiController,
          TransactionsApiController,
        ],
        providers: [...providers],
        exports: [...providers]
      }
    }
}
