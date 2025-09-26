import type { MonetaryAmount } from './index.js';


export interface Transaction { 
  id: string;
  accountId: string;
  counterpartyAccountId?: string;
  type: Transaction.TypeEnum;
  amount: MonetaryAmount;
  status: Transaction.StatusEnum;
  createdAt: string;
  metadata?: { [key: string]: string; };
}
export namespace Transaction {
  export const TypeEnum = {
    Credit: 'credit',
    Debit: 'debit',
    Transfer: 'transfer',
    Issuance: 'issuance',
    Redemption: 'redemption'
  } as const;
  export type TypeEnum = typeof TypeEnum[keyof typeof TypeEnum];
  export const StatusEnum = {
    Pending: 'pending',
    Posted: 'posted',
    Failed: 'failed'
  } as const;
  export type StatusEnum = typeof StatusEnum[keyof typeof StatusEnum];
}


