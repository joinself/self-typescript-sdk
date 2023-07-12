// Copyright 2020 Self Group Ltd. All Rights Reserved.message

import Jwt from './jwt'
import { v4 as uuidv4 } from 'uuid'

import IdentityService from './identity-service'
import Messaging from './messaging'

import * as message from './msgproto/message'
import * as metadata from './msgproto/metadata'
import * as mtype from './msgproto/msg-type'

import Crypto from './crypto'
import { logging, Logger } from './logging'
import { Recipient } from './crypto'

import * as flatbuffers from 'flatbuffers'

const logger = logging.getLogger('core.self-sdk')

export interface Request {
  [details: string]: any
}

/**
 * Service to manage interactions with self messaging services
 */
export default class MessagingService {
  is: IdentityService
  ms: Messaging
  jwt: Jwt
  crypto: Crypto
  connections: string[]
  logger: Logger

  /**
   * constructs a MessagingService
   * @param jwt a Jwt object
   * @param ms a Messaging object
   * @param is an IdentityService object
   */
  constructor(jwt: Jwt, ms: Messaging, is: IdentityService, ec: Crypto) {
    this.jwt = jwt
    this.ms = ms
    this.is = is
    this.crypto = ec
    this.connections = []
    this.logger = logging.getLogger('core.self-sdk')
  }

  /**
   * Subscribes to any message type and executes the callback when received.
   * @param callback procedure to be called when a new message is received.
   */
  subscribe(type: string, callback: any) {
    this.ms.subscribe(type, callback)
  }

  /**
   * closes the websocket connection.
   */
  close() {
    this.ms.close()
  }

  /**
   * isConnected checks if messaging is actually connected or not.
   * @returns bool
   */
  isConnected() {
    return this.ms.connected
  }

  /**
   * Gets the deviceID for your app
   */
  deviceID(): string {
    return '1'
  }

  /**
   * Sends a raw message
   * @param recipient the recipient/s identifier/s.
   * @param request the request to be sent.
   */
  async send(recipient: (string | Array<string>), request: Request, opts?: any): Promise<Response | boolean | void> {
    let recipientIDs = []
    let sub = ""
    if (!Array.isArray(recipient)) {
      sub = recipient
      recipientIDs = [recipient]
    } else {
      if (recipient.length == 1) sub = recipient[0];
      recipientIDs = recipient
    }

    // Check if the current app still has credits
    if (this.jwt.checkPaidActions) {
      let app = await this.is.app(this.jwt.appID)
      if (app.paid_actions == false) {
        throw new Error(
          'Your credits have expired, please log in to the developer portal and top up your account.'
        )
      }
    }

    let j = this.buildRequest(sub, request)
    console.log(j)
    let plaintext = this.jwt.toSignedJson(j)

    let recipients:Recipient[] = []

    // Send the message to all recipient devices.
    for (var k = 0; k < recipientIDs.length; k++) {
      if (recipientIDs[k] != this.jwt.appID) {
        let devices = await this.is.devices(recipientIDs[k])
        for (var i = 0; i < devices.length; i++) {
          this.logger.debug(`adding recipient ${recipientIDs[k]}:${devices[i]}`)
          recipients.push({
            id: recipientIDs[k],
            device: devices[i]
          })
        }
      }
    }

    // Send the message also to all current identity devices for synchronization.
    let currentIdentityDevices = await this.is.devices(this.jwt.appID)
    for (var i = 0; i < currentIdentityDevices.length; i++) {
      if (currentIdentityDevices[i] != this.jwt.deviceID) {
        this.logger.debug(`adding recipient ${this.jwt.appID}:${currentIdentityDevices[i]}`)
        recipients.push({
          id: this.jwt.appID,
          device: currentIdentityDevices[i]
        })
      }
    }

    let ct = await this.crypto.encrypt(plaintext, recipients)

    var msgs = []
    for (var i = 0; i < recipients.length; i++) {
      var msg = await this.buildEnvelope(uuidv4(), recipients[i].id, recipients[i].device, ct)
      msgs.push(msg)
    }

    let req = { data: msgs, waitForResponse: false }
    if (opts && opts["waitForResponse"] == true) {
      return await this.ms.request(j.jti, j.jti, msgs)
    }
    return await this.ms.send(j.jti, req)
  }

  /**
   * Sends a notification message
   * @param recipient the recipient's identifier.
   * @param message the message to be sent.
   */
  async notify(recipient: string, message: string): Promise<void> {
    await this.send(recipient, {
      typ: 'identities.notify',
      description: message
    })
  }

  private buildRequest(selfid: string, request: Request): Request {
    // Calculate expirations
    let iat = new Date(Math.floor(this.jwt.now()))
    let exp = new Date(Math.floor(this.jwt.now() + 300000 * 60))

    if (!('jti' in request)) {
        request['jti'] = uuidv4()
    }
    request['iss'] = this.jwt.appID
    request['iat'] = iat.toISOString()
    request['exp'] = exp.toISOString()
    if (!('cid' in request)) {
        request['cid'] = uuidv4()
    }
    if (!('gid' in request)) {
      request['sub'] = selfid
    }

    return request
  }

  async buildEnvelope(
    id: string,
    selfid: string,
    device: string,
    ciphertext: Uint8Array
  ): Promise<Uint8Array> {
    let builder = new flatbuffers.Builder(1024)

    let rid = builder.createString(id)
    let snd = builder.createString(`${this.jwt.appID}:${this.jwt.deviceID}`)
    let rcp = builder.createString(`${selfid}:${device}`)
    let ctx = message.Message.createCiphertextVector(
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

    let msg = message.Message.endMessage(builder)

    builder.finish(msg)

    return builder.asUint8Array()
  }

  buildDynamicLink(encodedBody: string, env: string, callback: string): string{
    let baseURL = `https://${env}.links.joinself.com`
    let portalURL = `https://developer.${env}.joinself.com`
    let apn = `com.joinself.app.${env}`

    if (env === '' || env === 'development') {
      baseURL = "https://links.joinself.com"
      portalURL = "https://developer.joinself.com"
      apn = "com.joinself.app"
      if (env === 'development') {
        apn = "com.joinself.app.dev"
      }
    }
    return `${baseURL}?link=${portalURL}/callback/${callback}%3Fqr=${encodedBody}&apn=${apn}`
  }
}
