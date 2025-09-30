import type { ApiImplementations } from '@qzd/sdk-api/server';
import { AccountsApiImpl } from './accounts.api.js';
import { AgentsApiImpl } from './agents.api.js';
import { AdminApiImpl } from './admin.api.js';
import { AuthApiImpl } from './auth.api.js';
import { HealthApiImpl } from './health.api.js';
import { LedgerApiImpl } from './ledger.api.js';
import { OfflineApiImpl } from './offline.api.js';
import { RemittancesApiImpl } from './remittances.api.js';
import { SmsApiImpl } from './sms.api.js';
import { TransactionsApiImpl } from './transactions.api.js';

export const apiImplementations: ApiImplementations = {
  accountsApi: AccountsApiImpl,
  agentsApi: AgentsApiImpl,
  adminApi: AdminApiImpl,
  authApi: AuthApiImpl,
  offlineApi: OfflineApiImpl,
  healthApi: HealthApiImpl,
  ledgerApi: LedgerApiImpl,
  remittancesApi: RemittancesApiImpl,
  smsApi: SmsApiImpl,
  transactionsApi: TransactionsApiImpl,
};

export {
  AccountsApiImpl,
  AgentsApiImpl,
  AdminApiImpl,
  AuthApiImpl,
  OfflineApiImpl,
  HealthApiImpl,
  LedgerApiImpl,
  RemittancesApiImpl,
  SmsApiImpl,
  TransactionsApiImpl,
};
