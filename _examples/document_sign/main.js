"use strict";
// Copyright 2020 Self Group Ltd. All Rights Reserved.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var self_sdk_1 = require("../../src/self-sdk");
var fs_1 = require("fs");
var groups = {};
// Wait til the response is received
var wait = function (seconds) {
    return new Promise(function (resolve) {
        return setTimeout(function () { return resolve(true); }, seconds * 1000);
    });
};
function setupSDK(appID, appSecret) {
    return __awaiter(this, void 0, void 0, function () {
        var opts, storageFolder, sdk;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    opts = { 'logLevel': 'debug' };
                    if (process.env["SELF_ENV"] != "") {
                        opts['env'] = process.env["SELF_ENV"];
                    }
                    storageFolder = __dirname.split("/").slice(0, -1).join("/") + "/.self_storage";
                    return [4 /*yield*/, self_sdk_1["default"].build(appID, appSecret, "random", storageFolder, opts)];
                case 1:
                    sdk = _a.sent();
                    return [4 /*yield*/, sdk.messaging().permitConnection("*")];
                case 2:
                    _a.sent();
                    return [2 /*return*/, sdk];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var appID, appSecret, selfID, sdk, terms, docs, content, resp, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    appID = process.env["SELF_APP_ID"];
                    appSecret = process.env["SELF_APP_SECRET"];
                    selfID = process.env["SELF_USER_ID"];
                    return [4 /*yield*/, setupSDK(appID, appSecret)];
                case 1:
                    sdk = _a.sent();
                    terms = "please, read and accept terms and conditions";
                    docs = [];
                    content = fs_1.readFileSync("./sample.pdf").toString('utf8');
                    docs.push({
                        name: "Terms and conditions",
                        data: content,
                        mime: "application/pdf"
                    });
                    return [4 /*yield*/, sdk.docs().requestSignature(selfID, terms, docs)];
                case 2:
                    resp = _a.sent();
                    if (resp["status"] == "accepted") {
                        console.log("Document signed!");
                        console.log("");
                        console.log("signned documents: ");
                        for (i = 0; i < resp["signed_objects"].length; i++) {
                            console.log("- Name : " + resp["signed_objects"]["name"]);
                            console.log("  Link : " + resp["signed_objects"]["link"]);
                            console.log("  Hash : " + resp["signed_objects"]["hash"]);
                        }
                        console.log("");
                        console.log("full signature");
                        console.log(resp["input"]);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
main();
