# USRemitAcquireQZDRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**remitterAccountId** | **string** |  | [default to undefined]
**beneficiaryAccountId** | **string** |  | [default to undefined]
**usdAmount** | [**MonetaryAmount**](MonetaryAmount.md) |  | [default to undefined]
**purposeCode** | **string** |  | [optional] [default to undefined]
**complianceDeclarations** | [**USRemitAcquireQZDRequestComplianceDeclarations**](USRemitAcquireQZDRequestComplianceDeclarations.md) |  | [optional] [default to undefined]

## Example

```typescript
import { USRemitAcquireQZDRequest } from './api';

const instance: USRemitAcquireQZDRequest = {
    remitterAccountId,
    beneficiaryAccountId,
    usdAmount,
    purposeCode,
    complianceDeclarations,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
