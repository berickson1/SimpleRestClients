import SyncTasks = require('synctasks');
import { WebRequestOptions, WebResponse } from './SimpleWebRequest';
export declare type HttpAction = 'POST' | 'GET' | 'PUT' | 'DELETE' | 'PATCH';
export interface ApiCallOptions extends WebRequestOptions {
    backendUrl?: string;
    excludeEndpointUrl?: boolean;
    eTag?: string;
}
export interface ETagResponse<T> {
    eTagMatched?: boolean;
    response?: T;
    eTag?: string;
}
export declare class GenericRestClient {
    protected _endpointUrl: string;
    protected _defaultOptions: ApiCallOptions;
    constructor(endpointUrl: string);
    protected _performApiCall<T>(apiPath: string, action: HttpAction, objToPost: any, givenOptions: ApiCallOptions): SyncTasks.Promise<WebResponse<T>>;
    private _performApiCallInternal<T>(apiPath, action, options);
    protected _getHeaders(): _.Dictionary<string>;
    protected _blockRequestUntil(options: ApiCallOptions): void | SyncTasks.Promise<void>;
    protected _processSuccessResponse<T>(resp: WebResponse<T>): void;
    performApiGet<T>(apiPath: string, options?: ApiCallOptions): SyncTasks.Promise<T>;
    performApiGetDetailed<T>(apiPath: string, options?: ApiCallOptions): SyncTasks.Promise<WebResponse<T>>;
    performApiPost<T>(apiPath: string, objToPost: any, options?: ApiCallOptions): SyncTasks.Promise<T>;
    performApiPostDetailed<T>(apiPath: string, objToPost: any, options?: ApiCallOptions): SyncTasks.Promise<WebResponse<T>>;
    performApiPatch<T>(apiPath: string, objToPatch: any, options?: ApiCallOptions): SyncTasks.Promise<T>;
    performApiPatchDetailed<T>(apiPath: string, objToPatch: any, options?: ApiCallOptions): SyncTasks.Promise<WebResponse<T>>;
    performApiPut(apiPath: string, objToPut: any, options?: ApiCallOptions): SyncTasks.Promise<void>;
    performApiPutDetailed(apiPath: string, objToPut: any, options?: ApiCallOptions): SyncTasks.Promise<WebResponse<void>>;
    performApiDelete(apiPath: string, objToDelete?: any, options?: ApiCallOptions): SyncTasks.Promise<void>;
    performApiDeleteDetailed(apiPath: string, objToDelete: any, options?: ApiCallOptions): SyncTasks.Promise<WebResponse<void>>;
}
