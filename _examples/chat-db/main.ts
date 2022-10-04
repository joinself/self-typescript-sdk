// Copyright 2020 Self Group Ltd. All Rights Reserved.

import SelfSDK from '../../src/self-sdk'
import { exit } from 'process';
import { ChatMessage } from '../../src/chat-message';
import { readFileSync, writeFileSync } from 'fs';
import { ChatGroup } from '../../src/chat-group';
import DBStore from './db';

let groups = {}

// Wait til the response is received
const wait = (seconds) =>
    new Promise(resolve =>
        setTimeout(() => resolve(true), seconds * 1000)
);

async function setupSDK(appID, appSecret, opts={'logLevel': 'debug'}): Promise<SelfSDK> {
  if (process.env["SELF_ENV"] != "") {
      opts['env'] = process.env["SELF_ENV"]
  }
  let storageFolder = __dirname.split("/").slice(0,-1).join("/") + "/.self_storage"
  const sdk = await SelfSDK.build( appID, appSecret, "random", storageFolder, opts);

  await sdk.messaging().permitConnection("*")

  return sdk
}

async function chat(appID: string, appSecret: string, selfID: string) {
    // const SelfSDK = require("self-sdk");
    let opts = {
      'logLevel': 'debug',
      'stateManager': DBStore.build()
    }
    const sdk = await setupSDK(appID, appSecret, opts)

    sdk.chat().onMessage(async (cm: ChatMessage) => {
      console.log(`chat.message received with ${cm.body}`)
      await wait(5)
      await cm.respond("tupu")
      await wait(5)
      let nm = await cm.message("supu")
      await wait(5)
      await nm.edit("about to be removed")
      await wait(5)
      await nm.delete()
    }, { 'mark_as_read': true })

    sdk.chat().onInvite(async (g: ChatGroup) => {
      console.log(`you've been invited to ${g.name}`)
      g.join()
      groups[g.gid] = g
      await wait(5)
      await groups[g.gid].message("hey!")
    })

    sdk.chat().onJoin(async (iss: string, gid: string) => {
      groups[gid].members.push(iss)
    })

    sdk.chat().onLeave(async (iss: string, gid: string) => {
      delete groups[gid].members[iss]
    })


    sdk.logger.info(`sending a message to ${selfID}`)
    await sdk.chat().message(selfID, "hello")

    await wait(30000)


    sdk.close()
    exit();
}

async function main() {
    let appID = process.env["SELF_APP_ID"]
    let appSecret = process.env["SELF_APP_SECRET"]
    let selfID = process.env["SELF_USER_ID"]

    // tsc main.ts && SELF_APP_ID="109a21fdd1bfaffa2717be1b4edb57e9" SELF_APP_SECRET="RmfQdahde0n5SSk1iF4qA2xFbm116RNjjZe47Swn1s4" SELF_USER_ID="35918759412" node main.js
    await chat(appID, appSecret, selfID);
}


main();





