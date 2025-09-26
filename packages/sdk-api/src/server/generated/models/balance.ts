import type { MonetaryAmount } from './index.js';


export interface Balance { 
  accountId: string;
  currency: string;
  available: MonetaryAmount;
  total: MonetaryAmount;
  updatedAt: string;
}

