import SyncTasks = require('synctasks');
export interface WebResponse<T> {
    url: string;
    method: string;
    statusCode: number;
    statusText: string;
    headers: _.Dictionary<string>;
    body: T;
}
export interface WebErrorResponse extends WebResponse<any> {
    canceled?: boolean;
    timedOut?: boolean;
}
export declare enum WebRequestPriority {
    DontCare = 0,
    Low = 1,
    Normal = 2,
    High = 3,
    Critical = 4,
}
export declare const enum ErrorHandlingType {
    DoNotRetry = 0,
    RetryUncountedImmediately = 1,
    RetryUncountedWithBackoff = 2,
    RetryCountedWithBackoff = 3,
}
export interface NativeBlobFileData {
    uri: string;
    size: number;
    name: string;
    type: string;
}
export interface NativeFileData {
    file: NativeBlobFileData | File;
}
export interface XMLHttpRequestProgressEvent extends Event {
    lengthComputable: boolean;
    loaded: number;
    path: string[];
    percent: number;
    position: number;
    total: number;
    totalSize: number;
}
export declare type SendDataType = Object | string | NativeFileData;
export interface WebRequestOptions {
    withCredentials?: boolean;
    retries?: number;
    priority?: WebRequestPriority;
    timeout?: number;
    acceptType?: string;
    contentType?: string;
    sendData?: SendDataType;
    headers?: _.Dictionary<string>;
    onProgress?: (progressEvent: XMLHttpRequestProgressEvent) => void;
    customErrorHandler?: (webRequest: SimpleWebRequest<any>, errorResponse: WebErrorResponse) => ErrorHandlingType;
    augmentErrorResponse?: (resp: WebErrorResponse) => void;
}
export declare let DefaultOptions: WebRequestOptions;
export interface SimpleWebRequestOptions {
    MaxSimultaneousRequests: number;
    setTimeout: (callback: () => void, timeoutMs?: number) => number;
    clearTimeout: (id: number) => void;
}
export declare let SimpleWebRequestOptions: SimpleWebRequestOptions;
export declare function DefaultErrorHandler(webRequest: SimpleWebRequest<any>, errResp: WebErrorResponse): ErrorHandlingType;
export declare class SimpleWebRequest<T> {
    private _action;
    private _url;
    private static requestQueue;
    private static executingList;
    private static _onLoadErrorSupportStatus;
    private static _timeoutSupportStatus;
    private _xhr;
    private _requestTimeoutTimer;
    private _deferred;
    private _options;
    private _aborted;
    private _timedOut;
    private _finishHandled;
    private _retryTimer;
    private _retryExponentialTime;
    constructor(_action: string, _url: string, options: WebRequestOptions);
    abort(): void;
    start(): SyncTasks.Promise<WebResponse<T>>;
    setUrl(newUrl: string): void;
    getRequestHeaders(): _.Dictionary<string>;
    setPriority(newPriority: WebRequestPriority): void;
    private _enqueue();
    private static checkQueueProcessing();
    private _fire();
    static mapContentType(contentType: string): string;
    static mapBody(sendData: SendDataType, contentType: string): SendDataType;
    private _getResponseInfo(statusCode);
    private _respond();
}
