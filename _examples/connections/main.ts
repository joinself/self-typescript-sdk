// Copyright 2020 Self Group Ltd. All Rights Reserved.

import SelfSDK from '../../src/self-sdk'
import { exit } from 'process';

async function manageConnections(appID: string, appSecret: string, user: string) {
    // const SelfSDK = require("self-sdk");
    let opts = {'logLevel': 'debug'}
    if (process.env["SELF_ENV"] != "") {
        opts['env'] = process.env["SELF_ENV"]
    }
    let storageFolder = __dirname.split("/").slice(0,-1).join("/") + "/.self_storage"
    const sdk = await SelfSDK.build( appID, appSecret, "random", storageFolder, opts);
    await sdk.start()

    sdk.logger.info("CONNECTIONS EXAMPLE")

    // Remove all existing connections
    let conns = await sdk.messaging().allowedConnections()
    sdk.logger.info("List existing connections")
    sdk.logger.info(` - connections : ${conns.join(",")}`)


    // Block connections from *
    sdk.logger.info("Block all connections")
    let success = await sdk.messaging().revokeConnection("*")
    if(!success) {
        throw new Error("problem revoking connection")
    }

    // List should be empty
    conns = await sdk.messaging().allowedConnections()
    sdk.logger.info(` - connections : ${conns.join(",")}`)

    // Allow connections from user
    sdk.logger.info("Permit connections from a specific ID")
    success = await sdk.messaging().permitConnection(user)
    if(!success) {
        throw new Error("problem permitting connection")
    }
    conns = await sdk.messaging().allowedConnections()
    sdk.logger.info(` - connections : ${conns.join(",")}`)


    // Allow connections from *
    sdk.logger.info("Permit all connections (replaces all other entries with a wildcard entry)")
    success = await sdk.messaging().permitConnection("*")
    if(!success) {
        throw new Error("problem permitting connection")
    }
    conns = await sdk.messaging().allowedConnections()
    sdk.logger.info(` - connections : ${conns.join(",")}`)
    sdk.logger.info("")

    // Allow connections from user
    sdk.logger.info("Permit connection from a specific ID (no change as the list already contains a wildcard entry)")
    success = await sdk.messaging().permitConnection(user)
    if(!success) {
        throw new Error("problem permitting connection")
    }
    conns = await sdk.messaging().allowedConnections()
    sdk.logger.info(` - connections : ${conns.join(",")}`)
    sdk.logger.info("")

    sdk.close()
    exit();
}

async function main() {
    let appID = process.env["SELF_APP_ID"]
    let appSecret = process.env["SELF_APP_SECRET"]
    let selfID = process.env["SELF_USER_ID"]

    await manageConnections(appID, appSecret, selfID);
}

main();



