# HealthApi

All URIs are relative to *https://api.qzd.rovira.pro*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getLiveness**](#getliveness) | **GET** /health/live | Liveness probe endpoint.|
|[**getReadiness**](#getreadiness) | **GET** /health/ready | Readiness probe endpoint.|

# **getLiveness**
> GetLiveness200Response getLiveness()


### Example

```typescript
import {
    HealthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new HealthApi(configuration);

const { status, data } = await apiInstance.getLiveness();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**GetLiveness200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Service is live. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getReadiness**
> GetReadiness200Response getReadiness()


### Example

```typescript
import {
    HealthApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new HealthApi(configuration);

const { status, data } = await apiInstance.getReadiness();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**GetReadiness200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Service is ready. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**503** | Service is not ready. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

