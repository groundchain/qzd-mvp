import type { ApiImplementations } from '../generated/index.js';
import { AccountsApiImpl } from './accounts.api.js';
import { AdminApiImpl } from './admin.api.js';
import { AuthApiImpl } from './auth.api.js';
import { HealthApiImpl } from './health.api.js';
import { LedgerApiImpl } from './ledger.api.js';
import { RemittancesApiImpl } from './remittances.api.js';
import { TransactionsApiImpl } from './transactions.api.js';

export const apiImplementations: ApiImplementations = {
  accountsApi: AccountsApiImpl,
  adminApi: AdminApiImpl,
  authApi: AuthApiImpl,
  healthApi: HealthApiImpl,
  ledgerApi: LedgerApiImpl,
  remittancesApi: RemittancesApiImpl,
  transactionsApi: TransactionsApiImpl,
};

export {
  AccountsApiImpl,
  AdminApiImpl,
  AuthApiImpl,
  HealthApiImpl,
  LedgerApiImpl,
  RemittancesApiImpl,
  TransactionsApiImpl,
};
