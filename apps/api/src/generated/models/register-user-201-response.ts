import type { Account } from './index.js';


export interface RegisterUser201Response { 
  userId?: string;
  account?: Account;
  /**
   * Session token for the newly created user.
   */
  token?: string;
}

