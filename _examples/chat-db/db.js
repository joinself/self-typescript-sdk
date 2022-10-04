"use strict";
exports.__esModule = true;
var Client = require('pg-native');
var DBStore = /** @class */ (function () {
    function DBStore() {
    }
    DBStore.build = function () {
        var client = new Client();
        client.connectSync(process.env.PG_URI);
        var createTableQuery = "\n      CREATE TABLE IF NOT EXISTS selfsdk(\n        path varchar PRIMARY KEY NOT NULL ,\n        val text,\n        date TIMESTAMP NOT NULL DEFAULT current_timestamp\n      );\n    ";
        var res = client.querySync(createTableQuery);
        var db = new DBStore();
        db.client = client;
        return db;
    };
    DBStore.prototype.write = function (path, value, opts) {
        if (opts === void 0) { opts = { flag: 'w' }; }
        var insertRow = this.client.querySync("\n      INSERT INTO selfsdk(path, val)\n      VALUES($1, $2)\n      ON CONFLICT (path)\n        DO\n      UPDATE SET val = $2;\n    ", ["" + path, "" + value]);
    };
    DBStore.prototype.read = function (path) {
        var entries = this.client.querySync('SELECT * FROM selfsdk WHERE path = $1;', [path]);
        if (entries.length == 0) {
            return null;
        }
        return entries[0].val;
    };
    DBStore.prototype.exists = function (path) {
        return null != this.read(path);
    };
    return DBStore;
}());
exports["default"] = DBStore;
