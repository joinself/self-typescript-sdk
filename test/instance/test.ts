import SelfSDK from '../../src/self-sdk'
import { exit } from 'process';

async function main() {
  try {
    let appID = "xx"
    let appSecret = "sk_1:secret"

    let storageFolder = __dirname.split("/").slice(0,-1).join("/") + "/.self_storage"
    const sdk = await SelfSDK.build(appID, appSecret, "random", storageFolder, {});
    // await sdk.start()
  } catch (error) {
    // Expect an error on the keys input
    if (error.toString() == "Error: invalid input") {
      console.log("success")
      exit()
    }
    console.log("error")
    exit(1)
  }

}

main()
