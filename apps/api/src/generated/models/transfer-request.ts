import type { MonetaryAmount } from './index.js';


export interface TransferRequest { 
  sourceAccountId: string;
  destinationAccountId: string;
  amount: MonetaryAmount;
  memo?: string;
}

