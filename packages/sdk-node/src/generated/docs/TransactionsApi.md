# TransactionsApi

All URIs are relative to *https://api.qzd.rovira.pro*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**initiateTransfer**](#initiatetransfer) | **POST** /tx/transfer | Move balances between accounts.|
|[**issueTokens**](#issuetokens) | **POST** /tx/issue | Issue new QZD tokens to an account.|
|[**listAccountTransactions**](#listaccounttransactions) | **GET** /accounts/{id}/transactions | List transactions recorded for a specific account.|
|[**redeemTokens**](#redeemtokens) | **POST** /tx/redeem | Redeem QZD tokens for fiat settlement.|

# **initiateTransfer**
> Transaction initiateTransfer(transferRequest)


### Example

```typescript
import {
    TransactionsApi,
    Configuration,
    TransferRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new TransactionsApi(configuration);

let transferRequest: TransferRequest; //

const { status, data } = await apiInstance.initiateTransfer(
    transferRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **transferRequest** | **TransferRequest**|  | |


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
|**202** | Transfer accepted for processing. |  -  |
|**400** | Invalid request payload or parameters. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**403** | The authenticated principal lacks required permissions. |  -  |
|**404** | The requested resource was not found. |  -  |
|**409** | The request conflicts with the current state of the resource. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **issueTokens**
> IssueEnvelope issueTokens(issueRequest)


### Example

```typescript
import {
    TransactionsApi,
    Configuration,
    IssueRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new TransactionsApi(configuration);

let issueRequest: IssueRequest; //

const { status, data } = await apiInstance.issueTokens(
    issueRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **issueRequest** | **IssueRequest**|  | |


### Return type

**IssueEnvelope**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**202** | Issuance request accepted. |  -  |
|**400** | Invalid request payload or parameters. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**403** | The authenticated principal lacks required permissions. |  -  |
|**404** | The requested resource was not found. |  -  |
|**409** | The request conflicts with the current state of the resource. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listAccountTransactions**
> ListAccountTransactions200Response listAccountTransactions()


### Example

```typescript
import {
    TransactionsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TransactionsApi(configuration);

let id: string; //Unique account identifier. (default to undefined)
let limit: number; //Maximum number of transactions to return. (optional) (default to undefined)
let cursor: string; //Cursor token for pagination. (optional) (default to undefined)

const { status, data } = await apiInstance.listAccountTransactions(
    id,
    limit,
    cursor
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Unique account identifier. | defaults to undefined|
| **limit** | [**number**] | Maximum number of transactions to return. | (optional) defaults to undefined|
| **cursor** | [**string**] | Cursor token for pagination. | (optional) defaults to undefined|


### Return type

**ListAccountTransactions200Response**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Transactions retrieved successfully. |  -  |
|**400** | Invalid request payload or parameters. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**403** | The authenticated principal lacks required permissions. |  -  |
|**404** | The requested resource was not found. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **redeemTokens**
> Transaction redeemTokens(redeemRequest)


### Example

```typescript
import {
    TransactionsApi,
    Configuration,
    RedeemRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new TransactionsApi(configuration);

let redeemRequest: RedeemRequest; //

const { status, data } = await apiInstance.redeemTokens(
    redeemRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **redeemRequest** | **RedeemRequest**|  | |


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
|**202** | Redemption request accepted. |  -  |
|**400** | Invalid request payload or parameters. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**403** | The authenticated principal lacks required permissions. |  -  |
|**404** | The requested resource was not found. |  -  |
|**409** | The request conflicts with the current state of the resource. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

