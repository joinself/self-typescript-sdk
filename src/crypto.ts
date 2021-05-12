import IdentityService from './identity-service'

export class Recipient {
  id: string
  device: string
}

export default class Crypto {
  client: IdentityService
  device: string
  storageKey: string
  storageFolder: string
  path: string
  account: Account

  constructor(client: IdentityService, device: string, storageFolder: string, storageKey: string) {
    this.client = client
    this.device = device
    this.storageFolder = storageFolder
    this.storageKey = storageKey
  }

  public static async build(
    client: IdentityService,
    device: string,
    storageFolder: string,
    storageKey: string
  ): Promise<Crypto> {
    let cc = new Crypto(client, device, storageFolder, storageKey)
    const fs = require('fs')
    const crypto = require('self-crypto')

    if (fs.existsSync(cc.accountPath())) {
      // 1a) if alice's account file exists load the pickle from the file
      let pickle = fs.readFileSync(cc.accountPath())
      cc.account = crypto.unpickle_account(pickle.toString(), cc.storageKey)
    } else {
      // 1b-i) if create a new account for alice if one doesn't exist already
      cc.account = crypto.create_olm_account_derrived_keys(cc.client.jwt.appKey)

      // 1b-ii) generate some keys for alice and publish them
      crypto.create_account_one_time_keys(cc.account, 100)

      // 1b-iii) convert those keys to json
      let oneTimeKeys = JSON.parse(crypto.one_time_keys(cc.account))

      let keys = Object.keys(oneTimeKeys['curve25519']).map(function(id) {
        return { id: id, key: oneTimeKeys['curve25519'][id] }
      })

      // 1b-iv) post those keys to POST /v1/identities/<selfid>/devices/1/pre_keys/
      let res = await cc.client.postRaw(
        `${cc.client.url}/v1/identities/${cc.client.jwt.appID}/devices/${cc.client.jwt.deviceID}/pre_keys`,
        keys
      )
      if (res != 200) {
        throw new Error('could not push identity pre_keys')
      }

      // 1b-v) store the account to a file
      let pickle = crypto.pickle_account(cc.account, cc.storageKey)
      fs.writeFileSync(cc.accountPath(), pickle, { mode: 0o600 })
    }

    return cc
  }

  public async encrypt(message: string, recipients: Recipient[]): Promise<string> {
    const fs = require('fs')
    const crypto = require('self-crypto')

    // create a group session and set the identity of the account youre using
    let group_session = crypto.create_group_session(
      `${this.client.jwt.appID}:${this.client.jwt.deviceID}`
    )

    let sessions = {}
    for (var i = 0; i < recipients.length; i++) {
      let session_file_name = this.sessionPath(recipients[i].id, recipients[i].device)
      let session_with_bob = await this.getOutboundSessionWithBob(recipients[i].id, recipients[i].device, session_file_name)

      crypto.add_group_participant(group_session, `${recipients[i].id}:${recipients[i].device}`, session_with_bob)

      sessions[session_file_name] = session_with_bob
    }

    // 5) encrypt a message
    let ciphertext = crypto.group_encrypt(group_session, message)

    // 6) store the sessions to a file
    for (const file in sessions) {
      let pickle = crypto.pickle_session(sessions[file], this.storageKey)
      fs.writeFileSync(file, pickle, { mode: 0o600 })
    }

    return ciphertext
  }

  public decrypt(message: string, sender: string, sender_device: string): string {
    const fs = require('fs')
    const crypto = require('self-crypto')

    let session_file_name = this.sessionPath(sender, sender_device)
    let session_with_bob = this.getInboundSessionWithBob(message, session_file_name)

    // 8) create a group session and set the identity of the account you're using
    let group_session = crypto.create_group_session(
      `${this.client.jwt.appID}:${this.client.jwt.deviceID}`
    )

    // 9) add all recipients and their sessions
    crypto.add_group_participant(group_session, `${sender}:${sender_device}`, session_with_bob)

    // 10) decrypt the message ciphertext
    let plaintextext = crypto.group_decrypt(group_session, `${sender}:${sender_device}`, message)

    // 11) store the session to a file
    let pickle = crypto.pickle_session(session_with_bob, this.storageKey)
    fs.writeFileSync(session_file_name, pickle, { mode: 0o600 })

    return plaintextext
  }

  public accountPath(): string {
    return `${this.storageFolder}/account.pickle`
  }

  public sessionPath(selfid: string, device: string): string {
    return `${this.storageFolder}/${selfid}:${device}-session.pickle`
  }


  private getInboundSessionWithBob(message: string, session_file_name: string): any {
    const fs = require('fs')
    const crypto = require('self-crypto')

    let session_with_bob: any

    if (fs.existsSync(session_file_name)) {
        // 7a) if bobs's session file exists load the pickle from the file
        let session = fs.readFileSync(session_file_name)
        session_with_bob = crypto.unpickle_session(session.toString(), this.storageKey)
      } else {
        // 7b-i) if you have not previously sent or received a message to/from bob,
        //       you should extract the initial message from the group message intended
        //       for your account id.

        let group_message_json = JSON.parse(message)
        let myID = `${this.client.jwt.appID}:${this.client.jwt.deviceID}`
        let ciphertext = group_message_json['recipients'][myID]['ciphertext']

        // 7b-ii) use the initial message to create a session for bob or carol
        session_with_bob = crypto.create_inbound_session(this.account, ciphertext)

        // 7b-iii) store the session to a file
        let pickle = crypto.pickle_session(session_with_bob, this.storageKey)
        fs.writeFileSync(session_file_name, pickle, { mode: 0o600 })

        // 7c-i) remove the sessions prekey from the account
        crypto.remove_one_time_keys(this.account, session_with_bob)

        // 7d-i) publish new prekeys if the amount of remaining keys has fallen below a threshold
        let currentOneTimeKeys = JSON.parse(crypto.one_time_keys(this.account))

        if (Object.keys(currentOneTimeKeys['curve25519']).length < 10) {
          // 7d-ii) generate some keys for alice and publish them
          crypto.create_account_one_time_keys(this.account, 100)

          let oneTimeKeys = JSON.parse(crypto.one_time_keys(this.account))

          let keys: Array<any>

          for (var i = 0; i < oneTimeKeys['curve25519']; i++) {
            let kid = oneTimeKeys['curve25519'][i]
            if (!(kid in currentOneTimeKeys)) {
              keys.push({ id: kid, key: oneTimeKeys['curve25519'][kid] })
            }
          }

          // 7d-iii) post those keys to POST /v1/identities/<selfid>/devices/1/pre_keys/
          this.client.postRaw(
            `${this.client.url}/v1/identities/${this.client.jwt.appID}/devices/${this.client.jwt.deviceID}/pre_keys`,
            keys
          )

          // TODO: (@adriacidre) : retry if the response is != 200
        }

        // 7e-i) save the account state
        let account_pickle = crypto.pickle_account(this.account, this.storageKey)
        fs.writeFileSync(this.accountPath(), account_pickle, { mode: 0o600 })
      }

      return session_with_bob
  }

  private async getOutboundSessionWithBob(recipient, recipientDevice, session_file_name: string): Promise<any> {
    const fs = require('fs')
    const crypto = require('self-crypto')

    let session_with_bob: any

    if (fs.existsSync(session_file_name)) {
        // 2a) if bob's session file exists load the pickle from the file
        let session = fs.readFileSync(session_file_name)
        session_with_bob = crypto.unpickle_session(session.toString(), this.storageKey)
      } else {
        // 2b-i) if you have not previously sent or recevied a message to/from bob,
        //       you must get his identity key from GET /v1/identities/bob/
        let ed25519_identity_key = await this.client.devicePublicKey(recipient, recipientDevice)

        // 2b-ii) get a one time key for bob
        let getRes = await this.client.getRaw(
          `${this.client.url}/v1/identities/${recipient}/devices/${recipientDevice}/pre_keys`
        )

        if (getRes.status != 200) {
          throw new Error('could not get identity pre_keys')
        }

        let one_time_key = getRes.data['key']

        // 2b-iii) convert bobs ed25519 identity key to a curve25519 key
        let curve25519_identity_key = crypto.ed25519_pk_to_curve25519(ed25519_identity_key)

        // 2b-iv) create the session with bob
        session_with_bob = crypto.create_outbound_session(
          this.account,
          curve25519_identity_key,
          one_time_key
        )

        // 2b-v) store the session to a file
        let pickle = crypto.pickle_session(session_with_bob, this.storageKey)
        fs.writeFileSync(session_file_name, pickle, { mode: 0o600 })
      }

      return session_with_bob
  }

}
