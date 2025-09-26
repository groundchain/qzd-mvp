# LedgerApi

All URIs are relative to *https://api.qzd.rovira.pro*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getAccountBalance**](#getaccountbalance) | **GET** /accounts/{id}/balance | Retrieve the latest balance snapshot for an account.|
|[**issueTokens**](#issuetokens) | **POST** /tx/issue | Issue new QZD tokens to an account.|
|[**listValidators**](#listvalidators) | **GET** /validators | Retrieve the validator set that anchors the QZD network.|
|[**redeemTokens**](#redeemtokens) | **POST** /tx/redeem | Redeem QZD tokens for fiat settlement.|

# **getAccountBalance**
> Balance getAccountBalance()


### Example

```typescript
import {
    LedgerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LedgerApi(configuration);

let id: string; //Unique account identifier. (default to undefined)

const { status, data } = await apiInstance.getAccountBalance(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Unique account identifier. | defaults to undefined|


### Return type

**Balance**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Account balance retrieved successfully. |  -  |
|**400** | Invalid request payload or parameters. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**403** | The authenticated principal lacks required permissions. |  -  |
|**404** | The requested resource was not found. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **issueTokens**
> IssueEnvelope issueTokens(issueRequest)


### Example

```typescript
import {
    LedgerApi,
    Configuration,
    IssueRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new LedgerApi(configuration);

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

# **listValidators**
> ListValidators200Response listValidators()


### Example

```typescript
import {
    LedgerApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LedgerApi(configuration);

const { status, data } = await apiInstance.listValidators();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**ListValidators200Response**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Validator list retrieved successfully. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**403** | The authenticated principal lacks required permissions. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **redeemTokens**
> Transaction redeemTokens(redeemRequest)


### Example

```typescript
import {
    LedgerApi,
    Configuration,
    RedeemRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new LedgerApi(configuration);

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

