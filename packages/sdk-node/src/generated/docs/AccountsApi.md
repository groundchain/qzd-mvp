# AccountsApi

All URIs are relative to *https://api.qzd.rovira.pro*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createAccount**](#createaccount) | **POST** /accounts | Create a new remittance ledger account.|
|[**getAccountBalance**](#getaccountbalance) | **GET** /accounts/{id}/balance | Retrieve the latest balance snapshot for an account.|
|[**listAccountTransactions**](#listaccounttransactions) | **GET** /accounts/{id}/transactions | List transactions recorded for a specific account.|

# **createAccount**
> Account createAccount(createAccountRequest)


### Example

```typescript
import {
    AccountsApi,
    Configuration,
    CreateAccountRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AccountsApi(configuration);

let createAccountRequest: CreateAccountRequest; //

const { status, data } = await apiInstance.createAccount(
    createAccountRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **createAccountRequest** | **CreateAccountRequest**|  | |


### Return type

**Account**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Account created successfully. |  -  |
|**400** | Invalid request payload or parameters. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**403** | The authenticated principal lacks required permissions. |  -  |
|**409** | The request conflicts with the current state of the resource. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getAccountBalance**
> Balance getAccountBalance()


### Example

```typescript
import {
    AccountsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AccountsApi(configuration);

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

# **listAccountTransactions**
> ListAccountTransactions200Response listAccountTransactions()


### Example

```typescript
import {
    AccountsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AccountsApi(configuration);

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

