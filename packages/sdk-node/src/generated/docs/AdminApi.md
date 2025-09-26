# AdminApi

All URIs are relative to *https://api.qzd.rovira.pro*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**listAdminAlerts**](#listadminalerts) | **GET** /admin/alerts | Retrieve open administrative alerts.|

# **listAdminAlerts**
> ListAdminAlerts200Response listAdminAlerts()


### Example

```typescript
import {
    AdminApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AdminApi(configuration);

const { status, data } = await apiInstance.listAdminAlerts();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**ListAdminAlerts200Response**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Alerts retrieved successfully. |  -  |
|**401** | Authentication credentials are missing or invalid. |  * WWW-Authenticate - Authentication challenge. <br>  |
|**403** | The authenticated principal lacks required permissions. |  -  |
|**429** | Rate limit exceeded. |  * Retry-After - Suggested wait time before retrying the readiness check in seconds. <br>  |
|**500** | Unexpected server error occurred. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

