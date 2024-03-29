// Copyright 2020 Self Group Ltd. All Rights Reserved.

import { v4 as uuidv4 } from 'uuid'
import { NTPClient } from 'ntpclient'
import { logging } from './logging'
import { SessionStorage } from './storage'
import SQLiteStorage from './storage';

const logger = logging.getLogger('core.self-sdk')

export interface JwtInput {
  protected: string
  payload: string
  signature: string
}

export default class Jwt {
  appID: string
  appKey: string
  appKeyID: string
  deviceID: string
  sodium: any
  keypair: any
  date: any
  ntpSynchronization: any
  diffDates: any
  checkPaidActions: boolean
  stateManager: SessionStorage

  constructor() {
    this.appID = ''
    this.appKey = ''
    this.appKeyID = '1'
    this.deviceID = '1'
  }

  public static async build(appID: string, appKey: string, storageFolder: string, opts?: {
      ntp?: boolean,
      deviceID?: string,
      checkPaidActions?: boolean,
      stateManager?: SessionStorage
    }): Promise<Jwt> {
    const jwt = new Jwt()
    jwt.appID = appID

    const appkeyParts = appKey.split(':')
    jwt.appKeyID = appkeyParts[0]
    jwt.appKey = appkeyParts[1]

    /* istanbul ignore next */
    opts = opts ? opts : {}

    /* istanbul ignore next */
    const ntp = 'ntp' in opts ? opts.ntp : true

    if ('stateManager' in opts) {
      jwt.stateManager = opts.stateManager
    } else {
      jwt.stateManager = new SQLiteStorage(jwt.appID, jwt.deviceID, storageFolder)
      await jwt.stateManager.setup()
    }

    if ('deviceID' in opts) {
      jwt.deviceID = opts.deviceID
    }

    jwt.checkPaidActions = true
    if ('checkPaidActions' in opts) {
      jwt.checkPaidActions = opts.checkPaidActions
    }

    const _sodium = require('libsodium-wrappers')
    /* istanbul ignore next */
    if (!ntp) {
      await Promise.all([_sodium.ready])
      jwt.diffDates = 0
    } else {
      /* istanbul ignore next */
      await Promise.all([jwt.ntpsync(), _sodium.ready])
      /* istanbul ignore next */
      jwt.ntpSynchronization = setInterval(jwt.ntpsync, 50000)
    }

    jwt.sodium = _sodium

    const seed = jwt.sodium.from_base64(jwt.appKey, jwt.sodium.base64_variants.ORIGINAL_NO_PADDING)
    jwt.keypair = jwt.sodium.crypto_sign_seed_keypair(seed)

    return jwt
  }

  public authToken(): string {
    const header = this.header()
    const fiveSecs = 5 * 1000
    const oneMinute = 1 * 60 * 1000

    const now = this.now()
    const jsonBody = JSON.stringify({
      jti: uuidv4(),
      cid: uuidv4(),
      iat: Math.floor((now - fiveSecs) / 1000),
      exp: Math.floor((now + oneMinute) / 1000),
      iss: this.appID,
      sub: this.appID,
      typ: 'auth.token'
    })
    const body = this.encode(jsonBody)

    const payload = `${header}.${body}`
    const signature = this.sign(payload)

    return `${payload}.${signature}`
  }

  public prepare(input: any) {
    return this.encode(this.toSignedJson(input))
  }

  public toSignedJson(input: any) {
    return JSON.stringify(this.toJWS(input))
  }

  public toJWS(input: any) {
    const jsonBody = JSON.stringify(input)
    const body = this.encode(jsonBody)

    const payload = `${this.header()}.${body}`
    const signature = this.sign(payload)

    return {
      payload: body,
      protected: this.header(),
      signature
    }
  }

  public sign(input: string): string {
    const signature = this.sodium.crypto_sign_detached(input, this.keypair.privateKey)
    return this.sodium.to_base64(signature, this.sodium.base64_variants.URLSAFE_NO_PADDING)
  }

  public verify(input: JwtInput, pk: any): boolean {
    try {
      const msg = `${input.protected}.${input.payload}`
      const sig = this.sodium.from_base64(
        input.signature,
        this.sodium.base64_variants.URLSAFE_NO_PADDING
      )
      const key = this.sodium.from_base64(pk, this.sodium.base64_variants.URLSAFE_NO_PADDING)

      return this.sodium.crypto_sign_verify_detached(sig, msg, key)
    } catch (error) {
      logger.warn(error)
      return false
    }
  }

  public now() {
    return new Date().valueOf() - this.diffDates
  }

  public stop() {
    clearInterval(this.ntpSynchronization)
  }

  /* istanbul ignore next */
  private async ntpsync(): Promise<void | Date> {
    return new NTPClient({
      server: 'time.google.com',
      port: 123,
      replyTimeout: 40 * 1000 // 10 seconds
    })
      .getNetworkTime()
      .then(date => {
        this.diffDates = new Date().valueOf() - date.valueOf()
      })
      .catch(err => logger.warn(err))
  }

  private header() {
    return this.encode(`{"alg":"EdDSA","typ":"JWT","kid":"` + this.appKeyID + `"}`)
  }

  encode(input: string): string {
    return this.sodium.to_base64(input, this.sodium.base64_variants.URLSAFE_NO_PADDING)
  }

  decode(input: string): string {
    return this.sodium.from_base64(input, this.sodium.base64_variants.URLSAFE_NO_PADDING)
  }
}
