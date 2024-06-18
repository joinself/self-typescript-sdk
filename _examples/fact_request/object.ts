// Copyright 2020 Self Group Ltd. All Rights Reserved.

import SelfSDK from '../../src/self-sdk'
import { exit } from 'process';
import { logging } from '../../src/logging';

const fs = require('fs');


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
        let res = await sdk.facts().request(selfID, [{ sources:['passport'], fact: 'photo' }])

        if (!res) {
          sdk.logger.warn(`fact request has timed out`)
        } else if (res.status === 'accepted') {
          let pn = res.attestationValuesFor('photo')[0]

          var o = await res.object(pn)
          await fs.writeFile('/tmp/photo.jpg', o.content, (err) => {
            if (err) throw err;
            console.log('The file has been saved!');
          });

          sdk.logger.info(`${selfID} open the requested picture at /tmp/photo.jpg"`)
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



