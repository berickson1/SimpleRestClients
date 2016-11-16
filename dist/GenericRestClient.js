/**
* GenericRestClient.ts
* Author: David de Regt
* Copyright: Microsoft 2015
*
* Base client type for accessing RESTful services
*/
"use strict";
var _ = require('lodash');
var SimpleWebRequest_1 = require('./SimpleWebRequest');
var GenericRestClient = (function () {
    function GenericRestClient(endpointUrl) {
        this._defaultOptions = {
            withCredentials: false,
            retries: 0,
            excludeEndpointUrl: false
        };
        this._endpointUrl = endpointUrl;
    }
    GenericRestClient.prototype._performApiCall = function (apiPath, action, objToPost, givenOptions) {
        var _this = this;
        var options = _.defaults({}, givenOptions || {}, this._defaultOptions);
        if (objToPost) {
            options.sendData = objToPost;
        }
        var promise = this._blockRequestUntil(options);
        if (!promise) {
            return this._performApiCallInternal(apiPath, action, options);
        }
        return promise.then(function () { return _this._performApiCallInternal(apiPath, action, options); });
    };
    GenericRestClient.prototype._performApiCallInternal = function (apiPath, action, options) {
        var _this = this;
        if (!options.headers) {
            options.headers = this._getHeaders();
        }
        if (options.eTag) {
            options.headers['If-None-Match'] = options.eTag;
        }
        if (!options.contentType) {
            options.contentType = _.isString(options.sendData) ? 'form' : 'json';
        }
        var finalUrl = options.excludeEndpointUrl ? apiPath : this._endpointUrl + apiPath;
        var request = new SimpleWebRequest_1.SimpleWebRequest(action, finalUrl, options);
        return request.start().then(function (resp) {
            _this._processSuccessResponse(resp);
            return resp;
        });
    };
    GenericRestClient.prototype._getHeaders = function () {
        // Virtual function -- No-op by default
        return {};
    };
    // Override (but make sure to call super and chain appropriately) this function if you want to add more blocking criteria.
    GenericRestClient.prototype._blockRequestUntil = function (options) {
        // No-op by default
        return undefined;
    };
    // Override this function to process any generic headers that come down with a successful response
    GenericRestClient.prototype._processSuccessResponse = function (resp) {
        // No-op by default
    };
    GenericRestClient.prototype.performApiGet = function (apiPath, options) {
        if (options === void 0) { options = null; }
        return this.performApiGetDetailed(apiPath, options).then(function (resp) { return resp.body; });
    };
    GenericRestClient.prototype.performApiGetDetailed = function (apiPath, options) {
        if (options === void 0) { options = null; }
        return this._performApiCall(apiPath, 'GET', null, options);
    };
    GenericRestClient.prototype.performApiPost = function (apiPath, objToPost, options) {
        if (options === void 0) { options = null; }
        return this.performApiPostDetailed(apiPath, objToPost, options).then(function (resp) { return resp.body; });
    };
    GenericRestClient.prototype.performApiPostDetailed = function (apiPath, objToPost, options) {
        if (options === void 0) { options = null; }
        return this._performApiCall(apiPath, 'POST', objToPost, options);
    };
    GenericRestClient.prototype.performApiPatch = function (apiPath, objToPatch, options) {
        if (options === void 0) { options = null; }
        return this.performApiPatchDetailed(apiPath, objToPatch, options).then(function (resp) { return resp.body; });
    };
    GenericRestClient.prototype.performApiPatchDetailed = function (apiPath, objToPatch, options) {
        if (options === void 0) { options = null; }
        return this._performApiCall(apiPath, 'PATCH', objToPatch, options);
    };
    GenericRestClient.prototype.performApiPut = function (apiPath, objToPut, options) {
        if (options === void 0) { options = null; }
        return this.performApiPutDetailed(apiPath, objToPut, options).then(_.noop);
    };
    GenericRestClient.prototype.performApiPutDetailed = function (apiPath, objToPut, options) {
        if (options === void 0) { options = null; }
        return this._performApiCall(apiPath, 'PUT', objToPut, options);
    };
    GenericRestClient.prototype.performApiDelete = function (apiPath, objToDelete, options) {
        if (objToDelete === void 0) { objToDelete = null; }
        if (options === void 0) { options = null; }
        return this.performApiDeleteDetailed(apiPath, objToDelete, options).then(_.noop);
    };
    GenericRestClient.prototype.performApiDeleteDetailed = function (apiPath, objToDelete, options) {
        if (options === void 0) { options = null; }
        return this._performApiCall(apiPath, 'DELETE', objToDelete, options);
    };
    return GenericRestClient;
}());
exports.GenericRestClient = GenericRestClient;
