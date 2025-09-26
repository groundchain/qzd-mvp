

export interface UploadAccountKycRequest { 
  accountId: string;
  kycLevel: UploadAccountKycRequest.KycLevelEnum;
  /**
   * Structured evidence payload such as document references.
   */
  metadata: { [key: string]: string; };
}
export namespace UploadAccountKycRequest {
  export const KycLevelEnum = {
    Basic: 'BASIC',
    Full: 'FULL'
  } as const;
  export type KycLevelEnum = typeof KycLevelEnum[keyof typeof KycLevelEnum];
}


