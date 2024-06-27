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
var process_1 = require("process");
var facts_service_1 = require("../../src/facts-service");
var fs_1 = require("fs");
function delay(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
function request(appID, appSecret, selfID) {
    return __awaiter(this, void 0, void 0, function () {
        var opts, storageFolder, sdk, source, content, obj, fact, res, at, o, error_1;
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
                    return [4 /*yield*/, sdk.start()];
                case 2:
                    _a.sent();
                    source = "supu";
                    content = fs_1.readFileSync("./my_image.png");
                    return [4 /*yield*/, sdk.newObject("test", content, "image/png")
                        // obj.save("./my_image_copy.jpg")
                    ];
                case 3:
                    obj = _a.sent();
                    fact = new facts_service_1.FactToIssue("image", obj, source);
                    sdk.logger.info("fact created");
                    sdk.logger.info("issuing fact");
                    return [4 /*yield*/, sdk.facts().issue(selfID, [fact])];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, delay(10000)];
                case 5:
                    _a.sent();
                    sdk.logger.info("sending a fact request (" + fact.key + ") to " + selfID);
                    sdk.logger.info("waiting for user input");
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 14, , 15]);
                    return [4 /*yield*/, sdk.facts().request(selfID, [{
                                fact: fact.key,
                                issuers: [appID]
                            }])];
                case 7:
                    res = _a.sent();
                    if (!!res) return [3 /*break*/, 8];
                    sdk.logger.warn("fact request has timed out");
                    return [3 /*break*/, 13];
                case 8:
                    if (!(res.status === 'accepted')) return [3 /*break*/, 12];
                    at = res.attestation(fact.key);
                    if (!(at != null)) return [3 /*break*/, 10];
                    sdk.logger.info(selfID + " digest is \"" + at.value + "\"");
                    return [4 /*yield*/, res.object(at.value)];
                case 9:
                    o = _a.sent();
                    o.save("./received.png");
                    sdk.logger.info("result stored at /tmp/received.png");
                    return [3 /*break*/, 11];
                case 10:
                    sdk.logger.warn("No attestations have been returned");
                    _a.label = 11;
                case 11: return [3 /*break*/, 13];
                case 12:
                    sdk.logger.warn(selfID + " has rejected your authentication request");
                    _a.label = 13;
                case 13: return [3 /*break*/, 15];
                case 14:
                    error_1 = _a.sent();
                    sdk.logger.error(error_1.toString());
                    return [3 /*break*/, 15];
                case 15:
                    sdk.close();
                    process_1.exit();
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var appID, appSecret, selfID;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    appID = process.env["SELF_APP_ID"];
                    appSecret = process.env["SELF_APP_SECRET"];
                    selfID = process.env["SELF_USER_ID"];
                    return [4 /*yield*/, request(appID, appSecret, selfID)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
main();
