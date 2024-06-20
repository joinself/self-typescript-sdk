// Copyright 2020 Self Group Ltd. All Rights Reserved.

import SelfSDK from '../../src/self-sdk'
import { exit } from 'process';
import { logging } from '../../src/logging';

async function request(appID: string, appSecret: string, selfID: string) {
    // const SelfSDK = require("self-sdk");
    let opts = {'logLevel': 'debug'}
    if (process.env["SELF_ENV"] != "") {
        opts['env'] = process.env["SELF_ENV"]
    }
    let storageFolder = __dirname.split("/").slice(0,-1).join("/") + "/.self_storage"
    const sdk = await SelfSDK.build( appID, appSecret, "random", storageFolder, opts);
    await sdk.start()

    sdk.logger.info(`sending a fact request (unverified_phone_number) to ${selfID}`)
    sdk.logger.info(`waiting for user input`)

    try {
        let res = await sdk.facts().request(selfID, [{ fact: 'unverified_phone_number' }])

        if (!res) {
          sdk.logger.warn(`fact request has timed out`)
        } else if (res.status === 'accepted') {
          let at = res.attestation('unverified_phone_number')
          if (at != null) {
            sdk.logger.info(`${selfID} phone number is "${at.value}"`)
          } else {
            sdk.logger.warn(`No attestations have been returned`)
          }
        } else {
          sdk.logger.warn(`${selfID} has rejected your authentication request`)
        }
    } catch (error) {
        sdk.logger.error(error.toString())
    }

    sdk.close()
    exit();
}

async function main() {
    let appID = process.env["SELF_APP_ID"]
    let appSecret = process.env["SELF_APP_SECRET"]
    let selfID = process.env["SELF_USER_ID"]

    await request(appID, appSecret, selfID);
}

main();



