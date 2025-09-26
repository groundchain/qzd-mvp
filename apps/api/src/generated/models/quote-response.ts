import type { MonetaryAmount } from './index.js';


export interface QuoteResponse { 
  quoteId: string;
  sellAmount: MonetaryAmount;
  buyAmount: MonetaryAmount;
  rate: string;
  expiresAt: string;
}

