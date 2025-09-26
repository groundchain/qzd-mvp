# UploadAccountKycRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**accountId** | **string** |  | [default to undefined]
**kycLevel** | **string** |  | [default to undefined]
**metadata** | **{ [key: string]: string; }** | Structured evidence payload such as document references. | [default to undefined]

## Example

```typescript
import { UploadAccountKycRequest } from './api';

const instance: UploadAccountKycRequest = {
    accountId,
    kycLevel,
    metadata,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
