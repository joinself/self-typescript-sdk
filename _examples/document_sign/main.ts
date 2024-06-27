// Copyright 2020 Self Group Ltd. All Rights Reserved.

import SelfSDK from '../../src/self-sdk'
import { exit } from 'process';
import { ChatMessage } from '../../src/chat-message';
import { readFileSync, writeFileSync } from 'fs';
import { ChatGroup } from '../../src/chat-group';


let groups = {}

// Wait til the response is received
const wait = (seconds) =>
    new Promise(resolve =>
        setTimeout(() => resolve(true), seconds * 1000)
);

async function setupSDK(appID, appSecret): Promise<SelfSDK> {
  let opts = {'logLevel': 'debug'}
  if (process.env["SELF_ENV"] != "") {
      opts['env'] = process.env["SELF_ENV"]
  }
  let storageFolder = __dirname.split("/").slice(0,-1).join("/") + "/.self_storage"
  const sdk = await SelfSDK.build( appID, appSecret, "random", storageFolder, opts);
  await sdk.start()

  return sdk
}

async function main() {
    let appID = process.env["SELF_APP_ID"]
    let appSecret = process.env["SELF_APP_SECRET"]
    let selfID = process.env["SELF_USER_ID"]

    // tsc main.ts && SELF_APP_ID="109a21fdd1bfaffa2717be1b4edb57e9" SELF_APP_SECRET="RmfQdahde0n5SSk1iF4qA2xFbm116RNjjZe47Swn1s4" SELF_USER_ID="35918759412" node main.js
    const sdk = await setupSDK(appID, appSecret)
    let terms = "please, read and accept terms and conditions"

    var content = readFileSync("./sample.pdf", null);

    let docs = [{
      name: "Terms and conditions",
      data: content,
      mime: "application/pdf"
    }]

    let resp = await sdk.docs().requestSignature(selfID, terms, docs)
    if (resp["status"] == "accepted") {
      console.log("Document signed!")
      console.log("")

      for (var i=0; i < resp["signed_objects"].length; i++) {
        console.log(`- Name : ${resp["signed_objects"][0]["name"]}`)
        console.log(`  Link : ${resp["signed_objects"][0]["link"]}`)
        console.log(`  Hash : ${resp["signed_objects"][0]["hash"]}`)
      }
      console.log("")
      console.log("full signature")
      console.log(resp["input"])
      exit(0);
    }

}


main();





