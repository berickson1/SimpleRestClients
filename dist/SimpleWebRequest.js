/**
* SimpleWebRequest.ts
* Author: David de Regt
* Copyright: Microsoft 2016
*
* Simple client for issuing web requests.
*/
"use strict";
var assert = require('assert');
var _ = require('lodash');
var SyncTasks = require('synctasks');
var ExponentialTime_1 = require('./ExponentialTime');
(function (WebRequestPriority) {
    WebRequestPriority[WebRequestPriority["DontCare"] = 0] = "DontCare";
    WebRequestPriority[WebRequestPriority["Low"] = 1] = "Low";
    WebRequestPriority[WebRequestPriority["Normal"] = 2] = "Normal";
    WebRequestPriority[WebRequestPriority["High"] = 3] = "High";
    WebRequestPriority[WebRequestPriority["Critical"] = 4] = "Critical";
})(exports.WebRequestPriority || (exports.WebRequestPriority = {}));
var WebRequestPriority = exports.WebRequestPriority;
function isJsonContentType(ct) {
    return ct && ct.indexOf('application/json') === 0;
}
function isFormContentType(ct) {
    return ct && ct.indexOf('application/x-www-form-urlencoded') === 0;
}
exports.DefaultOptions = {
    priority: WebRequestPriority.Normal
};
exports.SimpleWebRequestOptions = {
    MaxSimultaneousRequests: 5,
    setTimeout: setTimeout.bind(null),
    clearTimeout: clearTimeout.bind(null)
};
function DefaultErrorHandler(webRequest, errResp) {
    if (errResp.statusCode >= 400 && errResp.statusCode < 600) {
        // Fail 4xx/5xx requests immediately. These are permenent failures, and shouldn't have retry logic applied to them.
        return 0 /* DoNotRetry */;
    }
    // Possible transient failure -- just retry as normal with backoff.
    return 3 /* RetryCountedWithBackoff */;
}
exports.DefaultErrorHandler = DefaultErrorHandler;
var SimpleWebRequest = (function () {
    function SimpleWebRequest(_action, _url, options) {
        this._action = _action;
        this._url = _url;
        this._aborted = false;
        this._timedOut = false;
        // De-dupe result handling for two reasons so far:
        // 1. Various platforms have bugs where they double-resolves aborted xmlhttprequests
        // 2. Safari seems to have a bug where sometimes it double-resolves happily-completed xmlhttprequests
        this._finishHandled = false;
        this._retryExponentialTime = new ExponentialTime_1.ExponentialTime(1000, 300000);
        this._options = _.defaults(options, exports.DefaultOptions);
    }
    SimpleWebRequest.prototype.abort = function () {
        if (this._retryTimer) {
            exports.SimpleWebRequestOptions.clearTimeout(this._retryTimer);
            this._retryTimer = null;
        }
        if (this._requestTimeoutTimer) {
            exports.SimpleWebRequestOptions.clearTimeout(this._requestTimeoutTimer);
            this._requestTimeoutTimer = null;
        }
        if (!this._deferred) {
            assert.ok(false, 'Haven\'t even fired start() yet -- can\'t abort');
            return;
        }
        if (!this._aborted) {
            this._aborted = true;
            if (this._xhr) {
                // Abort the in-flight request
                this._xhr.abort();
            }
            else {
                // Not in flight
                this._respond();
            }
        }
        else {
            assert.ok(false, 'Already aborted request');
        }
    };
    SimpleWebRequest.prototype.start = function () {
        var _this = this;
        if (this._deferred) {
            assert.ok(false, 'WebRequest already started');
            return SyncTasks.Rejected('WebRequest already started');
        }
        this._deferred = SyncTasks.Defer();
        this._deferred.onCancel(function () {
            // Abort the XHR -- this should chain through to the fail case on readystatechange
            _this.abort();
        });
        this._enqueue();
        return this._deferred.promise();
    };
    SimpleWebRequest.prototype.setUrl = function (newUrl) {
        this._url = newUrl;
    };
    SimpleWebRequest.prototype.getRequestHeaders = function () {
        return _.clone(this._options.headers);
    };
    SimpleWebRequest.prototype.setPriority = function (newPriority) {
        var _this = this;
        if (this._options.priority === newPriority) {
            return;
        }
        this._options.priority = newPriority;
        if (this._xhr) {
            // Already fired -- wait for it to retry for the new priority to matter
            return;
        }
        // Remove and re-queue
        _.remove(SimpleWebRequest.requestQueue, function (item) { return item === _this; });
        this._enqueue();
    };
    SimpleWebRequest.prototype._enqueue = function () {
        var _this = this;
        // Throw it on the queue
        var index = _.findIndex(SimpleWebRequest.requestQueue, function (request) { return request._options.priority < _this._options.priority; });
        if (index > -1) {
            SimpleWebRequest.requestQueue.splice(index, 0, this);
        }
        else {
            SimpleWebRequest.requestQueue.push(this);
        }
        // See if it's time to execute it
        SimpleWebRequest.checkQueueProcessing();
    };
    SimpleWebRequest.checkQueueProcessing = function () {
        while (this.requestQueue.length > 0 && this.executingList.length < exports.SimpleWebRequestOptions.MaxSimultaneousRequests) {
            var req = this.requestQueue.shift();
            this.executingList.push(req);
            req._fire();
        }
    };
    // TSLint thinks that this function is unused.  Silly tslint.
    // tslint:disable-next-line
    SimpleWebRequest.prototype._fire = function () {
        var _this = this;
        this._xhr = new XMLHttpRequest();
        if (this._options.timeout) {
            var timeoutSupported_1 = SimpleWebRequest._timeoutSupportStatus;
            // Use manual timer if we don't know about timeout support
            if (timeoutSupported_1 !== 3 /* Supported */) {
                this._requestTimeoutTimer = exports.SimpleWebRequestOptions.setTimeout(function () {
                    _this._timedOut = true;
                    _this._requestTimeoutTimer = null;
                    _this.abort();
                }, this._options.timeout);
            }
            // This is our first completed request. Use it for feature detection
            if (timeoutSupported_1 === 3 /* Supported */ || timeoutSupported_1 <= 1 /* Detecting */) {
                // timeout and ontimeout are part of the XMLHttpRequest Level 2 spec, should be supported in most modern browsers
                this._xhr.timeout = this._options.timeout;
                this._xhr.ontimeout = function () {
                    SimpleWebRequest._timeoutSupportStatus = 3 /* Supported */;
                    if (timeoutSupported_1 !== 3 /* Supported */) {
                        // When this request initially fired we didn't know about support, bail & let the fallback method handle this
                        return;
                    }
                    _this._timedOut = true;
                    // Set aborted flag to match simple timer approach, which aborts the request and results in an _respond call
                    _this._aborted = true;
                    _this._respond();
                };
            }
        }
        // Apparently you're supposed to open the connection before adding events to it.  If you don't, the node.js implementation
        // of XHR actually calls this.abort() at the start of open()...  Bad implementations, hooray.
        this._xhr.open(this._action, this._url, true);
        var onLoadErrorSupported = SimpleWebRequest._onLoadErrorSupportStatus;
        // Use onreadystatechange if we don't know about onload support or it onload is not supported
        if (onLoadErrorSupported !== 3 /* Supported */) {
            if (onLoadErrorSupported === 0 /* Unknown */) {
                // Set global status to detecting, leave local state so we can set a timer on finish
                SimpleWebRequest._onLoadErrorSupportStatus = 1 /* Detecting */;
            }
            this._xhr.onreadystatechange = function (e) {
                if (_this._xhr.readyState !== 4) {
                    // Wait for it to finish
                    return;
                }
                // This is the first request completed (unknown status when fired, detecting now), use it for detection
                if (onLoadErrorSupported === 0 /* Unknown */ &&
                    SimpleWebRequest._onLoadErrorSupportStatus === 1 /* Detecting */) {
                    // If onload hasn't fired within 10 seconds of completion, detect as not supported
                    exports.SimpleWebRequestOptions.setTimeout(function () {
                        if (SimpleWebRequest._onLoadErrorSupportStatus !== 3 /* Supported */) {
                            SimpleWebRequest._onLoadErrorSupportStatus = 2 /* NotSupported */;
                        }
                    }, 10000);
                }
                _this._respond();
            };
        }
        if (onLoadErrorSupported !== 2 /* NotSupported */) {
            // onLoad and onError are part of the XMLHttpRequest Level 2 spec, should be supported in most modern browsers
            this._xhr.onload = function () {
                SimpleWebRequest._onLoadErrorSupportStatus = 3 /* Supported */;
                if (onLoadErrorSupported !== 3 /* Supported */) {
                    // When this request initially fired we didn't know about support, bail & let the fallback method handle this
                    return;
                }
                _this._respond();
            };
            this._xhr.onerror = function () {
                SimpleWebRequest._onLoadErrorSupportStatus = 3 /* Supported */;
                if (onLoadErrorSupported !== 3 /* Supported */) {
                    // When this request initially fired we didn't know about support, bail & let the fallback method handle this
                    return;
                }
                _this._respond();
            };
        }
        this._xhr.onabort = function (e) {
            // If the browser cancels us (page navigation or whatever), it sometimes calls both the readystatechange and this,
            // so make sure we know that this is an abort.
            _this._aborted = true;
            _this._respond();
        };
        if (this._xhr.upload && this._options.onProgress) {
            this._xhr.upload.onprogress = this._options.onProgress;
        }
        var acceptType = this._options.acceptType || 'json';
        this._xhr.responseType = acceptType === 'blob' ? 'arraybuffer' : 'json';
        this._xhr.setRequestHeader('Accept', SimpleWebRequest.mapContentType(acceptType));
        this._xhr.withCredentials = this._options.withCredentials;
        // check/process headers
        var headersCheck = {};
        _.each(this._options.headers, function (val, key) {
            var headerLower = key.toLowerCase();
            if (headerLower === 'content-type') {
                assert.ok(false, 'Don\'t set Content-Type with options.headers -- use it with the options.contentType property');
                return;
            }
            if (headerLower === 'accept') {
                assert.ok(false, 'Don\'t set Accept with options.headers -- use it with the options.acceptType property');
                return;
            }
            assert.ok(!headersCheck[headerLower], 'Setting duplicate header key: ' + headersCheck[headerLower] + ' and ' + key);
            if (!val) {
                assert.ok(false, 'Null header being sent for key: ' + key + '. This will crash android if let through.');
                return;
            }
            headersCheck[headerLower] = true;
            _this._xhr.setRequestHeader(key, val);
        });
        if (this._options.sendData) {
            var contentType = SimpleWebRequest.mapContentType(this._options.contentType || 'json');
            this._xhr.setRequestHeader('Content-Type', contentType);
            var sendData = SimpleWebRequest.mapBody(this._options.sendData, contentType);
            this._xhr.send(sendData);
        }
        else {
            this._xhr.send(null);
        }
    };
    SimpleWebRequest.mapContentType = function (contentType) {
        if (contentType === 'json') {
            return 'application/json';
        }
        else if (contentType === 'form') {
            return 'application/x-www-form-urlencoded';
        }
        else {
            return contentType;
        }
    };
    SimpleWebRequest.mapBody = function (sendData, contentType) {
        var body = sendData;
        if (isJsonContentType(contentType)) {
            if (!_.isString(sendData)) {
                body = JSON.stringify(sendData);
            }
        }
        else if (isFormContentType(contentType)) {
            if (!_.isString(sendData) && _.isObject(sendData)) {
                var params = _.map(sendData, function (val, key) {
                    return encodeURIComponent(key) + (val ? '=' + encodeURIComponent(val.toString()) : '');
                });
                body = params.join('&');
            }
        }
        return body;
    };
    SimpleWebRequest.prototype._getResponseInfo = function (statusCode) {
        if (!this._xhr) {
            return {
                url: this._url,
                method: this._action,
                statusCode: 0,
                statusText: 'Browser Error - Possible CORS or Connectivity Issue',
                headers: {},
                body: null
            };
        }
        // Parse out headers
        var headers = {};
        var headerLines = (this._xhr.getAllResponseHeaders() || '').split(/\r?\n/);
        headerLines.forEach(function (line) {
            if (line.length === 0) {
                return;
            }
            var index = line.indexOf(':');
            if (index === -1) {
                headers[line] = '';
            }
            else {
                headers[line.substr(0, index).toLowerCase()] = line.substr(index + 1).trim();
            }
        });
        // Some browsers apparently don't set the content-type header in some error conditions from getAllResponseHeaders but do return
        // it from the normal getResponseHeader.  No clue why, but superagent mentions it as well so it's best to just conform.
        if (!headers['content-type']) {
            var check = this._xhr.getResponseHeader('content-type');
            if (check) {
                headers['content-type'] = check;
            }
        }
        var body = this._xhr.response;
        if (headers['content-type'] && isJsonContentType(headers['content-type'])) {
            if (!body || !_.isObject(body)) {
                // Looks like responseType didn't parse it for us -- try shimming it in from responseText
                try {
                    // Even accessing responseText may throw
                    if (this._xhr.responseText) {
                        body = JSON.parse(this._xhr.responseText);
                    }
                }
                catch (e) {
                }
            }
        }
        return {
            url: this._url,
            method: this._action,
            statusCode: statusCode,
            statusText: this._xhr.statusText,
            headers: headers,
            body: body
        };
    };
    SimpleWebRequest.prototype._respond = function () {
        var _this = this;
        if (this._finishHandled) {
            // Aborted web requests often double-finish due to odd browser behavior, but non-aborted requests shouldn't...
            // Unfortunately, this assertion fires frequently in the Safari browser, presumably due to a non-standard
            // XHR implementation, so we need to comment it out.
            // This also might get hit during browser feature detection process
            //assert.ok(this._aborted || this._timedOut, 'Double-finished XMLHttpRequest');
            return;
        }
        // Pull it out of whichever queue it's sitting in
        if (this._xhr) {
            _.pull(SimpleWebRequest.executingList, this);
        }
        else {
            _.pull(SimpleWebRequest.requestQueue, this);
        }
        if (this._requestTimeoutTimer) {
            exports.SimpleWebRequestOptions.clearTimeout(this._requestTimeoutTimer);
            this._requestTimeoutTimer = null;
        }
        this._finishHandled = true;
        var statusCode = 0;
        var statusText = null;
        if (this._xhr) {
            try {
                statusCode = this._xhr.status;
                statusText = this._xhr.statusText;
            }
            catch (e) {
            }
        }
        var resp = this._getResponseInfo(statusCode);
        if ((statusCode >= 200 && statusCode < 300) || statusCode === 304) {
            // Happy path!
            this._deferred.resolve(resp);
        }
        else {
            var errResp = resp;
            errResp.canceled = this._aborted;
            errResp.timedOut = this._timedOut;
            errResp.statusText = statusText;
            if (this._options.augmentErrorResponse) {
                this._options.augmentErrorResponse(errResp);
            }
            if (errResp.canceled || errResp.statusCode === 0) {
                // Fail aborted requests and statusCode zero (bad connectivity/CORS) responses immediately, bypassing any
                // customErrorHandler, since there's no info to work off, these are always permanent failures.
                this._deferred.reject(errResp);
            }
            else {
                // Policy-adaptable failure
                var handleResponse = (this._options.customErrorHandler || DefaultErrorHandler)(this, errResp);
                var retry = this._options.retries > 0 || handleResponse === 1 /* RetryUncountedImmediately */ ||
                    handleResponse === 2 /* RetryUncountedWithBackoff */;
                if (retry) {
                    if (handleResponse === 3 /* RetryCountedWithBackoff */) {
                        this._options.retries--;
                    }
                    this._finishHandled = false;
                    // Clear the XHR since we technically just haven't started again yet...
                    this._xhr = undefined;
                    this._retryTimer = exports.SimpleWebRequestOptions.setTimeout(function () {
                        _this._retryTimer = null;
                        _this._enqueue();
                    }, this._retryExponentialTime.getTimeAndCalculateNext());
                }
                else {
                    // No more retries -- fail.
                    this._deferred.reject(errResp);
                }
            }
        }
        // Freed up a spot, so let's see if there's other stuff pending
        SimpleWebRequest.checkQueueProcessing();
    };
    // List of pending requests, sorted from most important to least important (numerically descending)
    SimpleWebRequest.requestQueue = [];
    // List of executing (non-finished) requests -- only to keep track of number of requests to compare to the max
    SimpleWebRequest.executingList = [];
    SimpleWebRequest._onLoadErrorSupportStatus = 0 /* Unknown */;
    SimpleWebRequest._timeoutSupportStatus = 0 /* Unknown */;
    return SimpleWebRequest;
}());
exports.SimpleWebRequest = SimpleWebRequest;
