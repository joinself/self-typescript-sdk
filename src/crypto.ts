import IdentityService from './identity-service'

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
      cc.account = crypto.unpickle_account(cc.accountPath(), cc.storageKey)
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

  public async encrypt(
    message: string,
    recipient: string,
    recipientDevice: string
  ): Promise<string> {
    console.log('ENCRYPTING')
    console.log('ENCRYPTING')
    console.log('ENCRYPTING')
    console.log('ENCRYPTING')
    let session_file_name = this.sessionPath(recipient, recipientDevice)
    let session_with_bob

    const fs = require('fs')
    const crypto = require('self-crypto')
    console.log(session_file_name)
    if (fs.existsSync(session_file_name)) {
      // 2a) if bob's session file exists load the pickle from the file
      let session = fs.readFileSync(session_file_name)
      session_with_bob = crypto.unpickle_session(session.toString(), this.storageKey)
    } else {
      // 2b-i) if you have not previously sent or recevied a message to/from bob,
      //       you must get his identity key from GET /v1/identities/bob/
      let ed25519_identity_key = await this.client.devicePublicKey(recipient, recipientDevice)
      console.log('--------------')
      console.log('--------------')
      console.log('--------------')
      console.log('--------------')
      console.log(ed25519_identity_key)
      console.log('--------------')
      console.log('--------------')
      console.log('--------------')
      console.log('--------------')

      // 2b-ii) get a one time key for bob
      let getRes = await this.client.getRaw(
        `${this.client.url}/v1/identities/${recipient}/devices/${recipientDevice}/pre_keys`
      )
      if (getRes.status != 200) {
        throw new Error('could not get identity pre_keys')
      }
      let one_time_key = getRes.data['key']

      // 2b-iii) convert bobs ed25519 identity key to a curve25519 key
      console.log('xoxoxoxo')
      console.log(ed25519_identity_key)
      let curve25519_identity_key = crypto.ed25519_pk_to_curve25519(ed25519_identity_key)
      console.log('==================')
      console.log('==================')
      console.log('==================')
      console.log('==================')
      console.log(curve25519_identity_key)
      console.log('==================')
      console.log('==================')
      console.log('==================')
      console.log('==================')
      console.log('xoxoxoxo')
      curve25519_identity_key = curve25519_identity_key.replace(/[^\x20-\x7E]/gim, '')

      // 2b-iv) create the session with bob
      session_with_bob = crypto.create_outbound_session(
        this.account,
        curve25519_identity_key,
        one_time_key
      )
      console.log('one time key:')
      console.log(one_time_key)

      // 2b-v) store the session to a file
      // TODO This does not exist on ruby sdk
      // let pickle = crypto.pickle_session(session_with_bob, this.storageKey)
      // fs.writeFileSync(session_file_name, pickle, { mode: 0o600 })
    }

    // 3) create a group session and set the identity of the account youre using
    console.log('create group session:')
    console.log(`${this.client.jwt.appID}:${this.client.jwt.deviceID}`)
    let group_session = crypto.create_group_session(
      `${this.client.jwt.appID}:${this.client.jwt.deviceID}`
    )

    console.log('add participant:')
    console.log(`${recipient}:${recipientDevice}`)
    // 4) add all recipients and their sessions
    crypto.add_group_participant(group_session, `${recipient}:${recipientDevice}`, session_with_bob)

    // 5) encrypt a message
    let ciphertext = crypto.group_encrypt(group_session, message)
    console.log('plain text')
    console.log(message)
    console.log('encrypted text')
    console.log(ciphertext)
    /*
    console.log("try to decrypt it!")

    var ciphertextForBob = JSON.parse(ciphertext)['recipients'][`${recipient}:${recipientDevice}`]['ciphertext']
    var sessionWithAlice = crypto.create_inbound_session(this.account, ciphertextForBob)
    let myID = `${this.client.jwt.appID}:${this.client.jwt.deviceID}`

    var groupSessionWithAlice = crypto.create_group_session(`${recipient}:${recipientDevice}`)
    crypto.add_group_participant(groupSessionWithAlice, myID, sessionWithAlice)
    var plaintextForBob = crypto.group_decrypt(groupSessionWithAlice, `${recipient}:${recipientDevice}`, ciphertext)
    console.log("--------")
    console.log(plaintextForBob)
    console.log("--------")
*/

    // 6) store the session to a file
    let pickle = crypto.pickle_session(session_with_bob, this.storageKey)
    fs.writeFileSync(session_file_name, pickle, { mode: 0o600 })

    var util = require('util')
    let utf8Encode = new util.TextEncoder()

    return utf8Encode.encode(ciphertext)
  }

  public decrypt(message: string, sender: string, sender_device: string): Promise<string> {
    let session_file_name = this.sessionPath(sender, sender_device)
    let session_with_bob

    const fs = require('fs')
    const crypto = require('self-crypto')

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

      console.log(' ----- > 1')
      console.log(ciphertext)
      // 7b-ii) use the initial message to create a session for bob or carol
      session_with_bob = crypto.create_inbound_session(this.account, ciphertext)
      console.log(' ----- > 2')

      // 7b-iii) store the session to a file
      let pickle = crypto.pickle_session(session_with_bob, this.storageKey)
      fs.writeFileSync(session_file_name, pickle, { mode: 0o600 })
      console.log(' ----- > 3')

      // 7c-i) remove the sessions prekey from the account
      crypto.remove_one_time_keys(this.account, session_with_bob)
      console.log(' ----- > 4')

      // 7d-i) publish new prekeys if the amount of remaining keys has fallen below a threshold
      let currentOneTimeKeys = JSON.parse(crypto.one_time_keys(this.account))
      console.log(' ----- > 5')

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

  private accountPath(): string {
    return `${this.storageFolder}/account.pickle`
  }

  private sessionPath(selfid: string, device: string): string {
    return `${this.storageFolder}/${selfid}:${device}-session.pickle`
  }
}
