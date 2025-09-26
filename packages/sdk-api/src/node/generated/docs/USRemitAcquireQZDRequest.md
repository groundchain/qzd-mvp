# USRemitAcquireQZDRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**usdAmount** | [**MonetaryAmount**](MonetaryAmount.md) |  | [default to undefined]
**senderPhone** | **string** | MSISDN of the sender initiating the remittance. | [default to undefined]
**receiverAccountId** | **string** | Beneficiary account identifier if known. | [optional] [default to undefined]
**receiverPhone** | **string** | Beneficiary phone number when an account identifier is unavailable. | [optional] [default to undefined]
**scenario** | **string** | Optional pricing program override for this acquisition. | [optional] [default to undefined]

## Example

```typescript
import { USRemitAcquireQZDRequest } from './api';

const instance: USRemitAcquireQZDRequest = {
    usdAmount,
    senderPhone,
    receiverAccountId,
    receiverPhone,
    scenario,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
