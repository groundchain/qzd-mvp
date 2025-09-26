

export interface Account { 
  id: string;
  ownerId: string;
  ownerName?: string;
  status: Account.StatusEnum;
  createdAt: string;
  metadata?: { [key: string]: string; };
}
export namespace Account {
  export const StatusEnum = {
    Active: 'active',
    Suspended: 'suspended',
    Closed: 'closed'
  } as const;
  export type StatusEnum = typeof StatusEnum[keyof typeof StatusEnum];
}


