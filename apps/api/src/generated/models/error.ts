

export interface ModelError { 
  code: string;
  message: string;
  details?: { [key: string]: string; };
}

