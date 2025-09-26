# Account


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**ownerId** | **string** |  | [default to undefined]
**ownerName** | **string** |  | [optional] [default to undefined]
**status** | **string** | Current account state. Frozen accounts are blocked from initiating transfers until reactivated. | [default to undefined]
**kycLevel** | **string** | Know Your Customer (KYC) tier that controls daily transfer limits. BASIC accounts may move up to Q5,000 per day while FULL accounts may transfer up to Q50,000 per day. | [default to undefined]
**createdAt** | **string** |  | [default to undefined]
**metadata** | **{ [key: string]: string; }** |  | [optional] [default to undefined]

## Example

```typescript
import { Account } from './api';

const instance: Account = {
    id,
    ownerId,
    ownerName,
    status,
    kycLevel,
    createdAt,
    metadata,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
