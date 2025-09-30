export type MonetaryAmount = {
  currency?: string;
  value?: string;
};

export type Balance = {
  available?: MonetaryAmount;
  total?: MonetaryAmount;
  updatedAt?: string | Date;
};

export type Transaction = {
  id: string;
  type: string;
  amount: MonetaryAmount;
  status: string;
  createdAt: string | Date;
  counterpartyAccountId?: string;
};

export type OfflineVoucher = {
  id?: string;
  fromCardId?: string;
  toAccountId?: string;
  amount?: MonetaryAmount;
  nonce?: string;
  signature?: string;
  expiresAt?: string | Date;
  status?: string;
};

export type QuoteResponse = {
  quoteId?: string;
  sellAmount?: MonetaryAmount;
  buyAmount?: MonetaryAmount;
  rate?: string;
  expiresAt?: string | Date;
};

export class Configuration {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options: Record<string, unknown> = {}) {}
}

export class AuthApi {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: Configuration) {}
  async registerUser(): Promise<{ token?: string; account?: { id?: string } }> {
    return {};
  }
  async loginUser(): Promise<{ token?: string }> {
    return {};
  }
}

export class AccountsApi {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: Configuration) {}
  async getAccountBalance(): Promise<Balance> {
    return {};
  }
}

export class TransactionsApi {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: Configuration) {}
  async listAccountTransactions(): Promise<{ items?: Transaction[] }> {
    return {};
  }
  async initiateTransfer(): Promise<void> {}
}

export class RemittancesApi {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: Configuration) {}
  async simulateQuote(): Promise<QuoteResponse> {
    return {};
  }
}

export class OfflineApi {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: Configuration) {}
  async createOfflineVoucher(): Promise<OfflineVoucher> {
    return {};
  }
  async redeemOfflineVoucher(): Promise<OfflineVoucher> {
    return {};
  }
}
