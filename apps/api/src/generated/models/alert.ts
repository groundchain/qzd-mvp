

export interface Alert { 
  id: string;
  severity: Alert.SeverityEnum;
  message: string;
  createdAt: string;
}
export namespace Alert {
  export const SeverityEnum = {
    Low: 'low',
    Medium: 'medium',
    High: 'high'
  } as const;
  export type SeverityEnum = typeof SeverityEnum[keyof typeof SeverityEnum];
}


