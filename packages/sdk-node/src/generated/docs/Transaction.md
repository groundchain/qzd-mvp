# Transaction


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**accountId** | **string** |  | [default to undefined]
**counterpartyAccountId** | **string** |  | [optional] [default to undefined]
**type** | **string** |  | [default to undefined]
**amount** | [**MonetaryAmount**](MonetaryAmount.md) |  | [default to undefined]
**status** | **string** |  | [default to undefined]
**createdAt** | **string** |  | [default to undefined]
**metadata** | **{ [key: string]: string; }** |  | [optional] [default to undefined]

## Example

```typescript
import { Transaction } from './api';

const instance: Transaction = {
    id,
    accountId,
    counterpartyAccountId,
    type,
    amount,
    status,
    createdAt,
    metadata,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
