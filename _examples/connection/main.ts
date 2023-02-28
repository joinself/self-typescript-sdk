// Copyright 2020 Self Group Ltd. All Rights Reserved.

import SelfSDK from '../../src/self-sdk'
import { exit } from 'process';

async function qrFactRequest(appID: string, appSecret: string, selfID: string) {
    // const SelfSDK = require("self-sdk");
    let opts = {'logLevel': 'debug'}
    if (process.env["SELF_ENV"] != "") {
        opts['env'] = process.env["SELF_ENV"]
    }
    let storageFolder = __dirname.split("/").slice(0,-1).join("/") + "/.self_storage"
    const sdk = await SelfSDK.build( appID, appSecret, "random", storageFolder, opts);
    await sdk.start()

    sdk.chat().onConnection((res: any): any => {
      sdk.logger.info(res)
      sdk.logger.info(`connection request ${res.status} by ${res.data.display_name}(${res.iss})`)
      sdk.chat().message(res.iss, "hi there!")
      exit()
    })

    // Generate a QR code to authenticate
    let buf = sdk.chat().generateConnectionQR()

    const fs = require('fs').promises;
    await fs.writeFile('/tmp/qr.png', buf);
    sdk.logger.info("Open /tmp/qr.png and scan it with your device")
    let link = sdk.chat().generateConnectionDeepLink("")
    sdk.logger.info("Or use this dynamic link on mobile " + link)

    // Wait til the response is received
    const wait = (seconds) =>
        new Promise(resolve =>
            setTimeout(() => resolve(true), seconds * 1000)
    );
    await wait(30000)

    sdk.close()
    exit()
}

async function main() {
    let appID = process.env["SELF_APP_ID"]
    let appSecret = process.env["SELF_APP_SECRET"]
    let selfID = process.env["SELF_USER_ID"]

    // tsc main.ts && SELF_APP_ID="109a21fdd1bfaffa2717be1b4edb57e9" SELF_APP_SECRET="RmfQdahde0n5SSk1iF4qA2xFbm116RNjjZe47Swn1s4" SELF_USER_ID="35918759412" node main.js
    await qrFactRequest(appID, appSecret, selfID);
}

main();



