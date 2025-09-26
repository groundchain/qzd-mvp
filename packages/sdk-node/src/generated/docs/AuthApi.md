# AuthApi

All URIs are relative to *https://api.qzd.rovira.pro*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**loginUser**](#loginuser) | **POST** /auth/login | Authenticate an existing user and issue a JWT session token.|
|[**registerUser**](#registeruser) | **POST** /auth/register | Register a new customer and provision an associated account.|

# **loginUser**
> LoginUser200Response loginUser(loginUserRequest)


### Example

```typescript
import {
    AuthApi,
    Configuration,
    LoginUserRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let loginUserRequest: LoginUserRequest; //

const { status, data } = await apiInstance.loginUser(
    loginUserRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **loginUserRequest** | **LoginUserRequest**|  | |


### Return type

**LoginUser200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Login successful. |  -  |
|**400** | Invalid request payload or parameters. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **registerUser**
> RegisterUser201Response registerUser(registerUserRequest)


### Example

```typescript
import {
    AuthApi,
    Configuration,
    RegisterUserRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new AuthApi(configuration);

let registerUserRequest: RegisterUserRequest; //

const { status, data } = await apiInstance.registerUser(
    registerUserRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **registerUserRequest** | **RegisterUserRequest**|  | |


### Return type

**RegisterUser201Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Registration successful. |  -  |
|**400** | Invalid request payload or parameters. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**409** | The request conflicts with the current state of the resource. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

