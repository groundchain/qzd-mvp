import type { MonetaryAmount } from './index.js';


/**
 * Transfer instructions count toward an account\'s daily movement limit. BASIC accounts may submit no more than Q5,000 per 24-hour window while FULL accounts may transfer up to Q50,000.
 */
export interface TransferRequest { 
  sourceAccountId: string;
  destinationAccountId: string;
  amount: MonetaryAmount;
  memo?: string;
}

