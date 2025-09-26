

export interface Account { 
  id: string;
  ownerId: string;
  ownerName?: string;
  /**
   * Current account state. Frozen accounts are blocked from initiating transfers until reactivated.
   */
  status: Account.StatusEnum;
  /**
   * Know Your Customer (KYC) tier that controls daily transfer limits. BASIC accounts may move up to Q5,000 per day while FULL accounts may transfer up to Q50,000 per day.
   */
  kycLevel: Account.KycLevelEnum;
  createdAt: string;
  metadata?: { [key: string]: string; };
}
export namespace Account {
  export const StatusEnum = {
    Active: 'ACTIVE',
    Frozen: 'FROZEN'
  } as const;
  export type StatusEnum = typeof StatusEnum[keyof typeof StatusEnum];
  export const KycLevelEnum = {
    Basic: 'BASIC',
    Full: 'FULL'
  } as const;
  export type KycLevelEnum = typeof KycLevelEnum[keyof typeof KycLevelEnum];
}


