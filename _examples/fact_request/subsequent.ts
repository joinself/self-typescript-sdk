// Copyright 2020 Self Group Ltd. All Rights Reserved.

import SelfSDK from '../../src/self-sdk'
import { exit } from 'process';
import { logging } from '../../src/logging';

const wait = (seconds) =>
    new Promise(resolve =>
        setTimeout(() => resolve(true), seconds * 1000)
);

async function request(appID: string, appSecret: string, selfID: string) {
    // const SelfSDK = require("self-sdk");
    let opts = {'logLevel': 'info'}
    if (process.env["SELF_ENV"] != "") {
        opts['env'] = process.env["SELF_ENV"]
    }
    let storageFolder = __dirname.split("/").slice(0,-1).join("/") + "/.self_storage"
    const sdk = await SelfSDK.build( appID, appSecret, "random", storageFolder, opts);
    await sdk.start()

    sdk.logger.info(`sending a fact request (unverified_phone_number) to ${selfID}`)
    sdk.logger.info(`waiting for user input`)

    try {
        let tenMinutes = 10 * 60 * 60
        let res = await sdk.facts().request(selfID, [{ fact: 'unverified_phone_number' }], { allowedFor: tenMinutes })

        if (!res) {
          sdk.logger.warn(`fact request has timed out`)
        } else if (res.status === 'accepted') {
          let pn = res.attestationValuesFor('unverified_phone_number')[0]
          sdk.logger.info(`${selfID} phone number is "${pn}"`)
          sdk.logger.info(`waiting 60 seconds to send the same request`)
          await wait(60)

          let res2 = await sdk.facts().request(selfID, [{ fact: 'unverified_phone_number' }], { allowedFor: tenMinutes })
          if (!res2) {
            sdk.logger.warn(`fact request has timed out`)
          } else if (res2.status === 'accepted') {
            sdk.logger.warn(`second fact request accepted`)
          } else {
            sdk.logger.warn(`second request rejected`)
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



