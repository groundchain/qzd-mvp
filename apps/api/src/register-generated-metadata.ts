import 'reflect-metadata';
import {
  AccountsApi,
  AccountsApiController,
  AdminApi,
  AdminApiController,
  AgentsApi,
  AgentsApiController,
  AuthApi,
  AuthApiController,
  OfflineApi,
  OfflineApiController,
  HealthApi,
  HealthApiController,
  LedgerApi,
  LedgerApiController,
  RemittancesApi,
  RemittancesApiController,
  TransactionsApi,
  TransactionsApiController,
} from '@qzd/sdk-api/server';

type ControllerConstructor = abstract new (...args: any[]) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any
type ApiConstructor = abstract new (...args: any[]) => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any

const controllerBindings: ReadonlyArray<readonly [ControllerConstructor, ApiConstructor]> = [
  [AccountsApiController, AccountsApi],
  [AdminApiController, AdminApi],
  [AgentsApiController, AgentsApi],
  [AuthApiController, AuthApi],
  [OfflineApiController, OfflineApi],
  [HealthApiController, HealthApi],
  [LedgerApiController, LedgerApi],
  [RemittancesApiController, RemittancesApi],
  [TransactionsApiController, TransactionsApi],
];

for (const [controller, api] of controllerBindings) {
  const existing = Reflect.getMetadata('design:paramtypes', controller) as unknown[] | undefined;
  if (!existing || existing.length === 0) {
    Reflect.defineMetadata('design:paramtypes', [api], controller);
  }
}
