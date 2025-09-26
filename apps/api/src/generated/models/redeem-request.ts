import type { MonetaryAmount } from './index.js';
import type { RedeemRequestDestinationBankAccount } from './index.js';


export interface RedeemRequest { 
  accountId: string;
  amount: MonetaryAmount;
  destinationBankAccount: RedeemRequestDestinationBankAccount;
}

