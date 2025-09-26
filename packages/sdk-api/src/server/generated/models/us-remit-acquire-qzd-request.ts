import type { MonetaryAmount } from './index.js';


export interface USRemitAcquireQZDRequest { 
  usdAmount: MonetaryAmount;
  /**
   * MSISDN of the sender initiating the remittance.
   */
  senderPhone: string;
  /**
   * Beneficiary account identifier if known.
   */
  receiverAccountId?: string;
  /**
   * Beneficiary phone number when an account identifier is unavailable.
   */
  receiverPhone?: string;
  /**
   * Optional pricing program override for this acquisition.
   */
  scenario?: USRemitAcquireQZDRequest.ScenarioEnum;
}
export namespace USRemitAcquireQZDRequest {
  export const ScenarioEnum = {
    Default: 'DEFAULT',
    Tariffed: 'TARIFFED',
    Subsidized: 'SUBSIDIZED'
  } as const;
  export type ScenarioEnum = typeof ScenarioEnum[keyof typeof ScenarioEnum];
}


