import type { MonetaryAmount } from './index.js';
import type { USRemitAcquireQZDRequestComplianceDeclarations } from './index.js';


export interface USRemitAcquireQZDRequest { 
  remitterAccountId: string;
  beneficiaryAccountId: string;
  usdAmount: MonetaryAmount;
  purposeCode?: string;
  complianceDeclarations?: USRemitAcquireQZDRequestComplianceDeclarations;
}

