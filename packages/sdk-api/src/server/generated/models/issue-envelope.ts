import type { IssueRequest } from './index.js';


export interface IssueEnvelope { 
  envelopeId: string;
  status: IssueEnvelope.StatusEnum;
  submittedAt: string;
  request: IssueRequest;
}
export namespace IssueEnvelope {
  export const StatusEnum = {
    Pending: 'pending',
    Completed: 'completed',
    Failed: 'failed'
  } as const;
  export type StatusEnum = typeof StatusEnum[keyof typeof StatusEnum];
}


