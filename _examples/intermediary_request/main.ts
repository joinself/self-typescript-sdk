// Copyright 2020 Self Group Ltd. All Rights Reserved.

import SelfSDK from '../../src/self-sdk'
import { exit } from 'process';

async function request(appID: string, appSecret: string, selfID: string) {
    // const SelfSDK = require("self-sdk");
    let opts = {'logLevel': 'debug'}
    if (process.env["SELF_ENV"] != "") {
        opts['env'] = process.env["SELF_ENV"]
    }
    let storageFolder = __dirname.split("/").slice(0,-1).join("/") + "/.self_storage"
    const sdk = await SelfSDK.build( appID, appSecret, "random", storageFolder, opts);
    await sdk.start()

    sdk.logger.info(`sending fact request through an intermediary to ${selfID}`)
    sdk.logger.info(`waiting for user input`)
    try {
        let res = await sdk.facts().requestViaIntermediary(selfID, [{
            fact: 'unverified_phone_number',
            operator: '==',
            sources: ['user_specified'],
            expected_value: '+44111222333'
        }])
        if(!res) {
            sdk.logger.warn(`fact request has timed out`)
        } else if(res.status === "unauthorized") {
            sdk.logger.warn("you are unauthorized to run this action")
        } else if (res.status === 'accepted') {
          const at = res.attestation('unverified_phone_number')
          if (at == null) {
            sdk.logger.warn(`No attestations have been returned`)
            sdk.close()
            exit();
          }
          sdk.logger.info(`your assertion is ${at.value}`)
        } else {
          sdk.logger.info("your request has been rejected")
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



