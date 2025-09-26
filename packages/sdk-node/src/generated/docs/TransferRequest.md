# TransferRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**sourceAccountId** | **string** |  | [default to undefined]
**destinationAccountId** | **string** |  | [default to undefined]
**amount** | [**MonetaryAmount**](MonetaryAmount.md) |  | [default to undefined]
**memo** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { TransferRequest } from './api';

const instance: TransferRequest = {
    sourceAccountId,
    destinationAccountId,
    amount,
    memo,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
