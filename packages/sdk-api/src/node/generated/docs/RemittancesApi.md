# RemittancesApi

All URIs are relative to *https://api.qzd.rovira.pro*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**acquireQZDForUSRemittance**](#acquireqzdforusremittance) | **POST** /remit/us/acquire-qzd | Initiate a US remittance flow that acquires QZD liquidity.|
|[**simulateQuote**](#simulatequote) | **GET** /simulate/quote | Simulate a quote for acquiring QZD against a fiat amount.|

# **acquireQZDForUSRemittance**
> Transaction acquireQZDForUSRemittance(uSRemitAcquireQZDRequest)


### Example

```typescript
import {
    RemittancesApi,
    Configuration,
    USRemitAcquireQZDRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new RemittancesApi(configuration);

let uSRemitAcquireQZDRequest: USRemitAcquireQZDRequest; //

const { status, data } = await apiInstance.acquireQZDForUSRemittance(
    uSRemitAcquireQZDRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **uSRemitAcquireQZDRequest** | **USRemitAcquireQZDRequest**|  | |


### Return type

**Transaction**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**202** | QZD issued to the beneficiary account. |  -  |
|**400** | Invalid request payload or parameters. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**403** | The authenticated principal lacks required permissions. |  -  |
|**404** | The requested resource was not found. |  -  |
|**409** | The request conflicts with the current state of the resource. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **simulateQuote**
> QuoteResponse simulateQuote()


### Example

```typescript
import {
    RemittancesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RemittancesApi(configuration);

let usdAmount: string; // (default to undefined)
let scenario: string; //Pricing program to apply to the remittance quote. Allowed values: DEFAULT, TARIFFED, SUBSIDIZED.  (optional) (default to undefined)

const { status, data } = await apiInstance.simulateQuote(
    usdAmount,
    scenario
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **usdAmount** | [**string**] |  | defaults to undefined|
| **scenario** | [**string**] | Pricing program to apply to the remittance quote. Allowed values: DEFAULT, TARIFFED, SUBSIDIZED.  | (optional) defaults to undefined|


### Return type

**QuoteResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Quote simulated successfully. |  -  |
|**400** | Invalid request payload or parameters. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**403** | The authenticated principal lacks required permissions. |  -  |
|**404** | The requested resource was not found. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

