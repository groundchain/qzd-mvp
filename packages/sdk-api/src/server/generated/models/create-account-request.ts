

export interface CreateAccountRequest { 
  ownerId: string;
  displayName?: string;
  metadata?: { [key: string]: string; };
}

