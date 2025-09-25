import type { HealthResponse } from '@qzd/shared';
import { healthResponseSchema } from '@qzd/shared';
import type { LedgerEntry, LedgerConfig } from '@qzd/ledger';
import { AppendOnlyLedger as Ledger, validateMultisig } from '@qzd/ledger';
export interface ApiClientOptions {
  baseUrl: string;
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async getHealth(): Promise<HealthResponse> {
    const response = await fetch(new URL('/health', this.options.baseUrl));
    const json = await response.json();
    return healthResponseSchema.parse(json);
  }
}

export function createLedger(config: LedgerConfig): Ledger {
  return new Ledger(config);
}

export { validateMultisig };
export type { LedgerEntry, LedgerConfig };
