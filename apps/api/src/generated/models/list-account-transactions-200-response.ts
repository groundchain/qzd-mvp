import type { Transaction } from './index.js';


export interface ListAccountTransactions200Response { 
  items?: Array<Transaction>;
  nextCursor?: string | null;
}

