# RemittancesApi

All URIs are relative to *https://api.qzd.rovira.pro*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**acquireQZDForUSRemittance**](#acquireqzdforusremittance) | **POST** /remit/us/acquire-qzd | Initiate a US remittance flow that acquires QZD liquidity.|
|[**simulateQuote**](#simulatequote) | **GET** /simulate/quote | Simulate a quote for acquiring QZD against a fiat amount.|

# **acquireQZDForUSRemittance**
> AcquireQZDForUSRemittance202Response acquireQZDForUSRemittance(uSRemitAcquireQZDRequest)


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

**AcquireQZDForUSRemittance202Response**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**202** | Remittance request accepted. |  -  |
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

let sellCurrency: string; // (default to undefined)
let sellAmount: string; // (default to undefined)
let buyCurrency: string; // (default to undefined)

const { status, data } = await apiInstance.simulateQuote(
    sellCurrency,
    sellAmount,
    buyCurrency
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sellCurrency** | [**string**] |  | defaults to undefined|
| **sellAmount** | [**string**] |  | defaults to undefined|
| **buyCurrency** | [**string**] |  | defaults to undefined|


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

