import type { HealthResponse } from '@qzd/shared';
import { healthResponseSchema } from '@qzd/shared';
import type { AppendOnlyLedger, LedgerEntry } from '@qzd/ledger';
import { AppendOnlyLedger as Ledger, createSigner } from '@qzd/ledger';
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

export function createLedger<T>(): AppendOnlyLedger<T> {
  return new Ledger<T>();
}

export { createSigner };
export type { LedgerEntry };
