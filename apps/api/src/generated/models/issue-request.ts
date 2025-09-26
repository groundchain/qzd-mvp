import type { MonetaryAmount } from './index.js';


export interface IssueRequest { 
  accountId: string;
  amount: MonetaryAmount;
  reference?: string;
}

