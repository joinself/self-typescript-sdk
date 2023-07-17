import IdentityService from './identity-service'
import SessionStorage, { txCallback } from './storage'
import { logging, Logger } from './logging'
import { Mutex } from 'async-mutex';

export class Recipient {
  id: string
  device: string
}

export default class Crypto {
  client: IdentityService
  device: string
  storageKey: string
  storage: SessionStorage
  path: string
  account: any
  logger: Logger
  mutex: Mutex

  constructor(client: IdentityService, device: string, storage: SessionStorage, storageKey: string) {
    this.mutex = new Mutex()
    this.client = client
    this.device = device
    this.storage = storage
    this.storageKey = storageKey
    this.logger = logging.getLogger('core.self-sdk')
  }

  public static async build(
    client: IdentityService,
    device: string,
    storage: SessionStorage,
    storageKey: string
  ): Promise<Crypto> {
    const cc = new Crypto(client, device, storage, storageKey)
    const crypto = require('self-crypto')

    await storage.tx(async () => {
      if (await storage.accountExists()) {
        // 1a) if alice's account file exists load the pickle from the file
        cc.account = crypto.unpickle_account(await storage.getAccountOlm(), cc.storageKey)
      } else {
        // 1b-i) if create a new account for alice if one doesn't exist already
        cc.account = crypto.create_olm_account_derrived_keys(cc.client.jwt.appKey)

        // 1b-ii) generate some keys for alice and publish them
        crypto.create_account_one_time_keys(cc.account, 100)

        // 1b-iii) convert those keys to json
        const oneTimeKeys = JSON.parse(crypto.one_time_keys(cc.account))

        const keys = Object.keys(oneTimeKeys['curve25519']).map((id) => {
          return { id, key: oneTimeKeys['curve25519'][id] }
        })

        // 1b-iv) post those keys to POST /v1/identities/<selfid>/devices/1/pre_keys/
        const res = await cc.client.postRaw(
          `${cc.client.url}/v1/identities/${cc.client.jwt.appID}/devices/${cc.client.jwt.deviceID}/pre_keys`,
          keys
        )
        if (res != 200) {
          throw new Error('could not push identity pre_keys')
        }

        // 1b-v) store the account to a file
        const pickle = crypto.pickle_account(cc.account, cc.storageKey)
        await storage.createAccount(pickle)
      }
    })

    return cc
  }

  public async encrypt(message: string, recipients: Recipient[]): Promise<Uint8Array> {
    this.logger.debug('encrypting a message')
    const crypto = require('self-crypto')

    // create a group session and set the identity of the account youre using
    this.logger.debug('create a group session and set the identity of the account youre using')
    const group_session = crypto.create_group_session(
      `${this.client.jwt.appID}:${this.client.jwt.deviceID}`
    )

    let ciphertext: Uint8Array
    await this.tx(async () => {
      const sessions = {}
      this.logger.debug('managing sessions with all recipients')
      for (const recipient of recipients) {
        const sid = this.storage.sid(recipient.id, recipient.device)
        if (sid == this.storage.appID) continue

        let session_with_bob = null
        try {
          const sOlm = await this.storage.getSessionOlm(sid)
          session_with_bob = await this.getOutboundSessionWithBob(recipient.id, recipient.device, sOlm)
        } catch (error) {
          this.logger.warn(`  there is a problem adding group participant ${recipient.id}:${recipient.device}, skipping...`)
          this.logger.warn(error)
          continue
        }

        this.logger.debug(`  adding group participant ${recipient.id}:${recipient.device}`)
        crypto.add_group_participant(group_session, `${recipient.id}:${recipient.device}`, session_with_bob)
        sessions[sid] = session_with_bob
      }

      // 5) encrypt a message
      this.logger.debug('group encrypting message')
      ciphertext = crypto.group_encrypt(group_session, message)

      // 6) store the sessions to a file
      this.logger.debug('storing sessions')
      for (const sid in sessions) {
        const pickle = crypto.pickle_session(sessions[sid], this.storageKey)
        await this.storage.updateSession(sid, pickle)
      }
    })
    return ciphertext
  }

  public async decrypt(message: Uint8Array, sender: string, sender_device: string): Promise<string> {
    this.logger.debug('decrypting a message')
    const fs = require('fs')
    const crypto = require('self-crypto')
    let plaintextext = ""

    await this.tx(async () => {
      this.logger.debug('loadding sessions')
      const sid = this.storage.sid(sender, sender_device)
      const sOlm = await this.storage.getSessionOlm(sid)
      const session_with_bob = await this.getInboundSessionWithBob(message, sOlm)

      // 8) create a group session and set the identity of the account you're using
      this.logger.debug(`create a group session and set the identity of the account ${this.client.jwt.appID}:${this.client.jwt.deviceID}`)
      const group_session = crypto.create_group_session(
        `${this.client.jwt.appID}:${this.client.jwt.deviceID}`
      )

      // 9) add all recipients and their sessions
      this.logger.debug(`add all recipients and their sessions ${sender}:${sender_device}`)
      crypto.add_group_participant(group_session, `${sender}:${sender_device}`, session_with_bob)

      // 10) decrypt the message ciphertext
      this.logger.debug(`decrypt the message ciphertext`)
      plaintextext = crypto.group_decrypt(group_session, `${sender}:${sender_device}`, Buffer.from(message).toString())

      // 11) store the session to a file
      this.logger.debug(`store the session to a file`)
      const pickle = crypto.pickle_session(session_with_bob, this.storageKey)
      await this.storage.updateSession(sid, pickle)
    })

    return plaintextext
  }


  async getInboundSessionWithBob(message: Uint8Array, pickle: string|null|undefined): Promise<any> {
    const crypto = require('self-crypto')

    let session_with_bob: any
    this.logger.debug(`getting inbound session wit bob`)

    const group_message_json = JSON.parse(Buffer.from(message).toString())
    const myID = `${this.client.jwt.appID}:${this.client.jwt.deviceID}`
    const mtype = group_message_json['recipients'][myID]['mtype']
    const ciphertext = group_message_json['recipients'][myID]['ciphertext']

    if (pickle != null && pickle != undefined) {
      // 7a) if carol's session file exists load the pickle from the file
      session_with_bob = crypto.unpickle_session(pickle, this.storageKey)
    }

    if (session_with_bob == null || mtype == 0 && !crypto.matches_inbound_session(session_with_bob, ciphertext)) {
        this.logger.debug(` bobs's session does not exist, let's create a new session`)
        // 7b-i) if you have not previously sent or received a message to/from bob,
        //       you should extract the initial message from the group message intended
        //       for your account id.
        this.logger.debug(` use the initial message to create a session for bob or carol`)
        // 7b-ii) use the initial message to create a session for bob or carol
        session_with_bob = crypto.create_inbound_session(this.account, ciphertext)

        // this.logger.debug(` store the session to a file`)
        // 7b-iii) store the session to a file
        // TODO: this is not present on ruby client....
        // let pickle = crypto.pickle_session(session_with_bob, this.storageKey)
        // this.client.jwt.stateManager.write(session_file_name, pickle, { mode: 0o600 })
        this.logger.debug(` remove the sessions prekey from the account`)
        // 7c-i) remove the sessions prekey from the account
        crypto.remove_one_time_keys(this.account, session_with_bob)

        // 7d-i) publish new prekeys if the amount of remaining keys has fallen below a threshold
        const currentOneTimeKeys = JSON.parse(crypto.one_time_keys(this.account))

        if (Object.keys(currentOneTimeKeys['curve25519']).length < 10) {
          this.logger.debug(` generate new prekeys as the amount of remaining keys has fallen below a threshold`)
          // 7d-ii) generate some keys for alice and publish them
          crypto.create_account_one_time_keys(this.account, 100)

          const oneTimeKeys = JSON.parse(crypto.one_time_keys(this.account))
          const keys: any[] = []
          for (let i = 0; i < oneTimeKeys['curve25519']; i++) {
            const kid = oneTimeKeys['curve25519'][i]
            if (!(kid in currentOneTimeKeys)) {
              keys.push({ id: kid, key: oneTimeKeys['curve25519'][kid] })
            }
          }

          // 7d-iii) post those keys to POST /v1/identities/<selfid>/devices/1/pre_keys/
          this.logger.debug(` publish new prekeys if the amount of remaining keys has fallen below a threshold`)
          while(true) {
            const status = await this.client.postRaw(
              `${this.client.url}/v1/identities/${this.client.jwt.appID}/devices/${this.client.jwt.deviceID}/pre_keys`,
              keys
            )
            if (status == 200) break;
            await new Promise(f => setTimeout(f, 1000)); // sleep
          }
        }

        this.logger.debug(` publish new prekeys if the amount of remaining keys has fallen below a threshold`)
        // 7e-i) save the account state
        const account_pickle = crypto.pickle_account(this.account, this.storageKey)

        await this.storage.updateAccount(account_pickle)
      }

      return session_with_bob
  }

  async getOutboundSessionWithBob(recipient: string, recipientDevice: string, pickle: any): Promise<any> {
    const crypto = require('self-crypto')

    let session_with_bob: any

    this.logger.debug(`getting outbound session with bob`)
    if (pickle !== null) {
      // 2a) if bob's session file exists load the pickle from the file
      this.logger.debug(`  bob's session file exists load the pickle from the file`)
      session_with_bob = crypto.unpickle_session(pickle, this.storageKey)
    } else {
      this.logger.debug(`  get bob's prekeys`)
      // 2b-i) if you have not previously sent or recevied a message to/from bob,
      //       you must get his identity key from GET /v1/identities/bob/
      const ed25519_identity_key = await this.client.devicePublicKey(recipient, recipientDevice)

      // 2b-ii) get a one time key for bob
      const getRes = await this.client.getRaw(
        `${this.client.url}/v1/identities/${recipient}/devices/${recipientDevice}/pre_keys`
      )

      if (getRes.status != 200) {
        throw new Error('could not get identity pre_keys')
      }

      const one_time_key = getRes.data['key']

      // 2b-iii) convert bobs ed25519 identity key to a curve25519 key
      const curve25519_identity_key = crypto.ed25519_pk_to_curve25519(ed25519_identity_key)

      // 2b-iv) create the session with bob
      session_with_bob = crypto.create_outbound_session(
        this.account,
        curve25519_identity_key,
        one_time_key
      )
    }

    return session_with_bob
  }

  async tx(callback: txCallback) {
    const release = await this.mutex.acquire();
    try {
      await this.storage.tx(async () => {
        await callback()
      })
    } finally {
      release();
    }
  }
}
