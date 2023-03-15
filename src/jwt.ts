// Copyright 2020 Self Group Ltd. All Rights Reserved.

import { randomUUID as uuidv4 } from 'crypto'
import { NTPClient } from 'ntpclient'
import { logging, Logger } from './logging'
import { IOManager } from './storage'
import FsStore from './storage';

const _sodium = require('libsodium-wrappers')
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
  stateManager: IOManager

  constructor() {
    this.appID = ''
    this.appKey = ''
    this.appKeyID = '1'
    this.deviceID = '1'
  }

  public static async build(appID: string, appKey: string, opts?: {
      ntp?: boolean,
      deviceID?: string,
      checkPaidActions?: boolean,
      stateManager?: IOManager
    }): Promise<Jwt> {
    let jwt = new Jwt()
    jwt.appID = appID

    let appkeyParts = appKey.split(':')
    jwt.appKeyID = appkeyParts[0]
    jwt.appKey = appkeyParts[1]

    /* istanbul ignore next */
    opts = opts ? opts : {}

    /* istanbul ignore next */
    let ntp = 'ntp' in opts ? opts.ntp : true

    if ('stateManager' in opts) {
      jwt.stateManager = opts.stateManager
    } else {
      jwt.stateManager = new FsStore()
    }

    if ('deviceID' in opts) {
      jwt.deviceID = opts.deviceID
    }

    jwt.checkPaidActions = true
    if ('checkPaidActions' in opts) {
      jwt.checkPaidActions = opts.checkPaidActions
    }

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

    let seed = jwt.sodium.from_base64(jwt.appKey, jwt.sodium.base64_variants.ORIGINAL_NO_PADDING)
    jwt.keypair = jwt.sodium.crypto_sign_seed_keypair(seed)

    return jwt
  }

  public authToken(): string {
    let header = this.header()
    let fiveSecs = 5 * 1000
    let oneMinute = 1 * 60 * 1000

    let now = this.now()
    let jsonBody = JSON.stringify({
      jti: uuidv4(),
      cid: uuidv4(),
      iat: Math.floor((now - fiveSecs) / 1000),
      exp: Math.floor((now + oneMinute) / 1000),
      iss: this.appID,
      sub: this.appID,
      typ: 'auth.token'
    })
    let body = this.encode(jsonBody)

    let payload = `${header}.${body}`
    let signature = this.sign(payload)

    return `${payload}.${signature}`
  }

  public prepare(input: any) {
    return this.encode(this.toSignedJson(input))
  }

  public toSignedJson(input: any) {
    return JSON.stringify(this.toJWS(input))
  }

  public toJWS(input: any) {
    let jsonBody = JSON.stringify(input)
    let body = this.encode(jsonBody)

    let payload = `${this.header()}.${body}`
    let signature = this.sign(payload)

    return {
      payload: body,
      protected: this.header(),
      signature: signature
    }
  }

  public sign(input: string): string {
    let signature = this.sodium.crypto_sign_detached(input, this.keypair.privateKey)
    return this.sodium.to_base64(signature, this.sodium.base64_variants.URLSAFE_NO_PADDING)
  }

  public verify(input: JwtInput, pk: any): boolean {
    try {
      let msg = `${input.protected}.${input.payload}`
      let sig = this.sodium.from_base64(
        input.signature,
        this.sodium.base64_variants.URLSAFE_NO_PADDING
      )
      let key = this.sodium.from_base64(pk, this.sodium.base64_variants.URLSAFE_NO_PADDING)

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
      .catch(err => console.error(err))
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
