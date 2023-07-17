// Copyright 2020 Self Group Ltd. All Rights Reserved.

import { v4 as uuidv4 } from 'uuid'
import {
  QRCode,
  ErrorCorrectLevel,
  QRNumber,
  QRAlphaNum,
  QR8BitByte,
  QRKanji
} from 'qrcode-generator-ts/js'

import IdentityService from './identity-service'
import Jwt from './jwt'
import Messaging from './messaging'
import Fact from './fact'
import * as message from './msgproto/message'
import * as metadata from './msgproto/metadata'
import * as mtype from './msgproto/msg-type'
import FactResponse from './fact-response'
import MessagingService from './messaging-service'
import Crypto from './crypto'
import { logging, Logger } from './logging'

import * as flatbuffers from 'flatbuffers'

type MessageProcessor = (n: number) => any
const logger = logging.getLogger('core.self-sdk')

/**
 * A service to manage fact requests
 */
export default class Requester {
  DEFAULT_INTERMEDIARY = 'self_intermediary'

  jwt: Jwt
  ms: Messaging
  is: IdentityService
  env: string
  messagingService: MessagingService
  crypto: Crypto
  logger: Logger
  authSubscription: (n: any) => any
  factSubscription: (n: any) => any

  /**
   * The constructor for FactsService
   * @param jwt the Jwt
   * @param ms the Messaging object
   * @param is the IdentityService
   * @param env the environment on what you want to run your app.
   */
  constructor(jwt: Jwt, ms: MessagingService, is: IdentityService, ec: Crypto, env: string) {
    this.jwt = jwt
    this.ms = ms.ms
    this.messagingService = ms
    this.is = is
    this.env = env
    this.crypto = ec
    this.logger = logging.getLogger('core.self-sdk')
  }

  /**
   * Send a fact request to a specific user
   * @param selfid user identifier to send the fact request.
   * @param facts an array with the facts you're requesting.
   * @param opts optional parameters like conversation id or the expiration time
   */
  async request(
    selfid: string,
    facts: Fact[],
    opts?: { cid?: string; exp?: number; async?: boolean, allowedFor?: number, auth?: boolean }
  ): Promise<FactResponse> {
    const options = opts ? opts : {}
    const as = options.async ? options.async : false

    // Check if the current app still has credits
    if (this.jwt.checkPaidActions) {
      const app = await this.is.app(this.jwt.appID)
      if (app.paid_actions == false) {
        throw new Error(
          'Your credits have expired, please log in to the developer portal and top up your account.'
        )
      }
    }

    const id = uuidv4()

    // Get user's device
    const devices = await this.is.devices(selfid)

    const j = this.buildRequest(selfid, facts, opts)
    const ciphertext = this.jwt.toSignedJson(j)

    const msgs = []
    for (const device of devices) {
      const msg = await this.buildEnvelope(id, selfid, device, ciphertext)
      msgs.push(msg)
    }

    if (as) {
      logger.debug('sending ' + id)
      this.ms.send(j.cid, { data: msgs, waitForResponse: false })

      const response = new FactResponse()
      response.status = '200'
      return response
    }

    logger.debug(`requesting ${id}`)
    const res = await this.ms.request(j.cid, id, msgs)
    if ('errorMessage' in res) {
      throw new Error(res.errorMessage)
    }

    return res
  }

  async buildEnvelope(
    id: string,
    selfid: string,
    device: string,
    plaintext: string
  ): Promise<Uint8Array> {
    const ciphertext = await this.crypto.encrypt(plaintext, [{
      id: selfid,
      device,
    }])

    const builder = new flatbuffers.Builder(1024)

    const rid = builder.createString(id)
    const snd = builder.createString(`${this.jwt.appID}:${this.jwt.deviceID}`)
    const rcp = builder.createString(`${selfid}:${device}`)
    const ctx = message.Message.createCiphertextVector(
      builder,
      Buffer.from(ciphertext)
    )

    message.Message.startMessage(builder)
    message.Message.addId(builder, rid)
    message.Message.addMsgtype(builder, mtype.MsgType.MSG)
    message.Message.addSender(builder, snd)
    message.Message.addRecipient(builder, rcp)
    message.Message.addCiphertext(builder, ctx)

    message.Message.addMetadata(builder,
      metadata.Metadata.createMetadata(
        builder,
        flatbuffers.createLong(0, 0),
        flatbuffers.createLong(0, 0)
      )
    )

    const msg = message.Message.endMessage(builder)

    builder.finish(msg)

    return builder.asUint8Array()
  }

  /**
   * Sends a request via an intermediary
   * @param selfid user identifier to send the fact request.
   * @param facts an array with the facts you're requesting.
   * @param opts optional parameters like conversation id or the expiration time
   * or the selfid of the intermediary you want to use (defaulting to self_intermediary)
   */
  async requestViaIntermediary(
    selfid: string,
    facts: Fact[],
    opts?: { cid?: string; exp?: number; intermediary?: string, allowedFor?: number }
  ): Promise<FactResponse> {
    const options = opts ? opts : {}

    // Check if the current app still has credits
    if (this.jwt.checkPaidActions) {
      const app = await this.is.app(this.jwt.appID)
      if (app.paid_actions == false) {
        throw new Error(
          'Your credits have expired, please log in to the developer portal and top up your account.'
        )
      }
    }

    const id = uuidv4()

    // Get intermediary's device
    const intermediary = options.intermediary ? options.intermediary : 'self_intermediary'
    const devices = await this.is.devices(intermediary)
    opts['aud'] = intermediary

    const j = this.buildRequest(selfid, facts, opts)
    const ciphertext = this.jwt.toSignedJson(j)

    // Envelope
    const msgs = []
    for (const device of devices) {
      const msg = await this.buildEnvelope(id, intermediary, device, ciphertext)
      msgs.push(msg)
    }

    logger.debug(`requesting ${j.cid}`)
    const res = await this.ms.request(j.cid, id, msgs)
    if ('errorMessage' in res) {
      throw new Error(res.errorMessage)
    }

    return res
  }

  /**
   * Subscribes to fact responses `identities.facts.query.resp` and calls
   * the given callback.
   * @param callback procedure to be called when a new facts response is received.
   */
  subscribe(auth: boolean, callback: (n: any) => any) {
    // TODO: manage auth and non-auth requests
    if(auth == true) {
      this.authSubscription = callback
    } else {
      this.factSubscription = callback
    }
    this.ms.subscribe('identities.facts.query.resp', (res: any) => {
      if (res.auth) {
        if (this.authSubscription) {
          this.authSubscription(res)
        }
      } else {
        if (this.factSubscription) {
          this.factSubscription(res)
        }
      }
    })
  }

  /**
   * Generates a QR code your users can scan from their app to share facts with your app.
   * @param facts an array with the facts you're requesting.
   * @param opts allows you specify optional parameters like the conversation id <cid>, the selfid or the expiration time.
   */
  generateQR(facts: Fact[], opts?: { selfid?: string; cid?: string; exp?: number }): Buffer {
    const options = opts ? opts : {}
    const selfid = options.selfid ? options.selfid : '-'
    const body = this.jwt.toSignedJson(this.buildRequest(selfid, facts, options))

    const qr = new QRCode()
    qr.setTypeNumber(20)
    qr.setErrorCorrectLevel(ErrorCorrectLevel.L)
    qr.addData(body)
    qr.make()

    const data = qr.toDataURL(5).split(',')
    const buf = Buffer.from(data[1], 'base64')

    return buf
  }

  /**
   * Generates a deep link url so you can request facts with a simple link.
   * @param callback the redirection identifier you'll be redirected to if the app is not installed.
   * @param facts an array with the facts you're requesting.
   * @param opts optional parameters like selfid or conversation id
   */
  generateDeepLink(
    callback: string,
    facts: Fact[],
    opts?: { selfid?: string; cid?: string }
  ): string {
    const options = opts ? opts : {}
    const selfid = options.selfid ? options.selfid : '-'
    const body = this.jwt.toSignedJson(this.buildRequest(selfid, facts, options))
    const encodedBody = this.jwt.encode(body)
    return this.messagingService.buildDynamicLink(encodedBody, this.env, callback)
  }

  /**
   * builds an authentication request
   * @param selfid identifier for the user you want to authenticate
   * @param facts an array with the facts you're requesting.
   * @param opts optional parameters like conversation id or the expiration time
   */
  private buildRequest(selfid: string, facts: Fact[], opts?: { cid?: string; exp?: number, allowedFor?: number, auth?: boolean, aud?: string }): any {
    const options = opts ? opts : {}
    const cid = options.cid ? options.cid : uuidv4()
    const expTimeout = options.exp ? options.exp : 300000
    const aud = options.aud ? options.aud : selfid

    for (const fact of facts) {
      if (!Fact.isValid(fact)) {
        throw new TypeError('invalid facts')
      }
    }

    // Calculate expirations
    const iat = new Date(Math.floor(this.jwt.now()))
    const exp = new Date(Math.floor(this.jwt.now() + expTimeout * 60))

    // Ciphertext
    const c = {
      typ: 'identities.facts.query.req',
      iss: this.jwt.appID,
      sub: selfid,
      aud,
      iat: iat.toISOString(),
      exp: exp.toISOString(),
      cid,
      jti: uuidv4(),
      facts
    }

    if ('allowedFor' in options) {
      const au = new Date(Math.floor(this.jwt.now() + options.allowedFor * 60))
      c['allowed_until'] = au.toISOString()
    }

    if ('auth' in options) {
      c['auth'] = options.auth
    }

    return c
  }
}
