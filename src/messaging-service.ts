// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from './jwt'
import { v4 as uuidv4 } from 'uuid'

import IdentityService from './identity-service'
import Messaging from './messaging'

import * as acl from './msgproto/acl_generated'
import * as message from './msgproto/message_generated'
import * as mtype from './msgproto/types_generated'

import Crypto from './crypto'
import { logging, Logger } from './logging'
import { Recipient } from './crypto'

import * as flatbuffers from 'flatbuffers'

const logger = logging.getLogger('core.self-sdk')

export interface Request {
  [details: string]: any
}

export interface ACLRule {
  [source: string]: Date
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
   * Allows incomming messages from the specified identity.
   * @param selfid The identifier for the identity (user or app) to be permitted.
   * Use `*` to permit all.
   * @returns a response
   */
  async permitConnection(selfid: string): Promise<boolean | Response> {
    logger.debug('permitting connection')
    if (this.connections.includes(selfid)) {
      logger.debug('skipping : connection is already permitted')
      return true
    }

    this.connections.push(selfid)
    let payload = this.jwt.toSignedJson({
      jti: uuidv4(),
      cid: uuidv4(),
      typ: 'acl.permit',
      iss: this.jwt.appID,
      sub: this.jwt.appID,
      iat: new Date(Math.floor(this.jwt.now())).toISOString(),
      exp: new Date(Math.floor(this.jwt.now() + (1 * 60 * 60))).toISOString(),
      acl_source: selfid,
    })

    let id = uuidv4()

    let builder = new flatbuffers.Builder(1024)

    let rid = builder.createString(id)
    let pld = acl.SelfMessaging.ACL.createPayloadVector(
      builder,
      Buffer.from(payload)
    )

    acl.SelfMessaging.ACL.startACL(builder)
    acl.SelfMessaging.ACL.addId(builder, rid)
    acl.SelfMessaging.ACL.addMsgtype(builder, mtype.SelfMessaging.MsgType.ACL)
    acl.SelfMessaging.ACL.addCommand(builder, mtype.SelfMessaging.ACLCommand.PERMIT)
    acl.SelfMessaging.ACL.addPayload(builder, pld)

    let aclReq = acl.SelfMessaging.ACL.endACL(builder)

    builder.finish(aclReq)

    let buf = builder.asUint8Array()

    return this.ms.send_and_wait(id, { data: buf })
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
   * Lists the current connections of your app.
   * @returns a list of ACL rules
   */
  async allowedConnections(): Promise<String[]> {
    logger.debug('listing allowed connections')

    if (this.connections.length === 0) {
      let id = uuidv4()

      let builder = new flatbuffers.Builder(1024)

      let rid = builder.createString(id)

      acl.SelfMessaging.ACL.startACL(builder)
      acl.SelfMessaging.ACL.addId(builder, rid)
      acl.SelfMessaging.ACL.addMsgtype(builder, mtype.SelfMessaging.MsgType.ACL)
      acl.SelfMessaging.ACL.addCommand(builder, mtype.SelfMessaging.ACLCommand.LIST)
      let aclReq = acl.SelfMessaging.ACL.endACL(builder)

      builder.finish(aclReq)

      let buf = builder.asUint8Array()

      let res = await this.ms.request(id, id, buf)
      this.connections = res
    }

    return this.connections
  }

  /**
   * Checks if the current app is allowing incoming messages from the given id.
   * @param id the self identifier to be checked
   */
  async isPermited(id: string): Promise<Boolean> {
    let ac = await this.allowedConnections()
    if (ac.includes('*')) {
      return true
    }

    if (ac.includes(id)) {
      return true
    }

    return false
  }

  /**
   * Revokes messages from the given identity
   * @param selfid identity to revoke
   * @returns Response
   */
  async revokeConnection(selfid: string): Promise<boolean | Response> {
    logger.debug('revoking connection')
    const index = this.connections.indexOf(selfid, 0);
    if (index > -1) {
      this.connections.splice(index, 1);
    }

    let payload = this.jwt.toSignedJson({
      iss: this.jwt.appID,
      sub: this.jwt.appID,
      iat: new Date(Math.floor(this.jwt.now())).toISOString(),
      exp: new Date(Math.floor(this.jwt.now() + 1 * 60)).toISOString(),
      acl_source: selfid,
      jti: uuidv4(),
      cid: uuidv4(),
      typ: 'acl.revoke'
    })

    let id = uuidv4()

    let builder = new flatbuffers.Builder(1024)

    let rid = builder.createString(id)
    let pld = acl.SelfMessaging.ACL.createPayloadVector(
      builder,
      Buffer.from(payload)
    )

    acl.SelfMessaging.ACL.startACL(builder)
    acl.SelfMessaging.ACL.addId(builder, rid)
    acl.SelfMessaging.ACL.addMsgtype(builder, mtype.SelfMessaging.MsgType.ACL)
    acl.SelfMessaging.ACL.addCommand(builder, mtype.SelfMessaging.ACLCommand.REVOKE)
    acl.SelfMessaging.ACL.addPayload(builder, pld)

    let aclReq = acl.SelfMessaging.ACL.endACL(builder)

    builder.finish(aclReq)

    let buf = builder.asUint8Array()

    return this.ms.send_and_wait(id, { data: buf })
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
  async send(recipient: (string | Array<string>), request: Request): Promise<void> {
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
        this.logger.debug(`adding recipient ${recipientIDs[k]}:${currentIdentityDevices[i]}`)
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

    this.ms.send(j.cid, { data: msgs, waitForResponse: false })
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
    let ctx = message.SelfMessaging.Message.createCiphertextVector(
      builder,
      Buffer.from(ciphertext)
    )

    message.SelfMessaging.Message.startMessage(builder)
    message.SelfMessaging.Message.addId(builder, rid)
    message.SelfMessaging.Message.addMsgtype(builder, mtype.SelfMessaging.MsgType.MSG)
    message.SelfMessaging.Message.addSender(builder, snd)
    message.SelfMessaging.Message.addRecipient(builder, rcp)

    message.SelfMessaging.Message.addCiphertext(builder, ctx)

    message.SelfMessaging.Message.addMetadata(builder,
      message.SelfMessaging.Metadata.createMetadata(
        builder,
        flatbuffers.createLong(0, 0),
        flatbuffers.createLong(0, 0)
      )
    )

    let msg = message.SelfMessaging.Message.endMessage(builder)

    builder.finish(msg)

    return builder.asUint8Array()
  }
}
