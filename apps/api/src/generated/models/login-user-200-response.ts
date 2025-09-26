

export interface LoginUser200Response { 
  token?: string;
  /**
   * Token expiration time in seconds.
   */
  expiresIn?: number;
}

