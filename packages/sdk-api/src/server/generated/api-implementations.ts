import { Type } from '@nestjs/common';
import { AccountsApi } from './api/index.js';
import { AdminApi } from './api/index.js';
import { AuthApi } from './api/index.js';
import { HealthApi } from './api/index.js';
import { LedgerApi } from './api/index.js';
import { RemittancesApi } from './api/index.js';
import { TransactionsApi } from './api/index.js';

/**
 * Provide this type to {@link ApiModule} to provide your API implementations
**/
export type ApiImplementations = {
  accountsApi: Type<AccountsApi>
  adminApi: Type<AdminApi>
  authApi: Type<AuthApi>
  healthApi: Type<HealthApi>
  ledgerApi: Type<LedgerApi>
  remittancesApi: Type<RemittancesApi>
  transactionsApi: Type<TransactionsApi>
};
