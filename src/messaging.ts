// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from './jwt'
import IdentityService from './identity-service'

import * as acl from './msgproto/acl_generated'
import * as auth from './msgproto/auth_generated'
import * as header from './msgproto/header_generated'
import * as message from './msgproto/message_generated'
import * as notification from './msgproto/notification_generated'
import * as mtype from './msgproto/types_generated'
import Crypto from './self-crypto'
import FactResponse from './fact-response'

import * as fs from 'fs'
import { openStdin } from 'process'
import { randomUUID as uuidv4 } from 'crypto'
import * as flatbuffers from 'flatbuffers'
import { Identity, App } from './identity-service'
import { logging, Logger } from './logging'

const defaultRequestTimeout = 120000

export interface Request {
  data: string | ArrayBuffer | SharedArrayBuffer | Blob | ArrayBufferView | Array<string>
  uuid?: string
  acknowledged?: boolean
  waitForResponse?: boolean
  responded?: boolean
  response?: any
  timeout?: number
}

export default class Messaging {
  url: string
  jwt: Jwt
  ws: WebSocket
  connected: boolean
  requests: Map<string, Request>
  callbacks: Map<string, (n: any) => any>
  is: IdentityService
  offsetPath: string
  storageDir: string
  encryptionClient: Crypto
  logger: Logger
  started: boolean

  constructor(
    url: string,
    jwt: Jwt,
    is: IdentityService,
    ec: Crypto,
    opts?: { storageDir?: string }
  ) {
    this.jwt = jwt
    this.url = url
    this.requests = new Map()
    this.callbacks = new Map()
    this.connected = false
    this.is = is
    this.encryptionClient = ec
    this.offsetPath = `${process.cwd()}/.self_storage`
    if (opts) {
      if ('storageDir' in opts) {
        this.offsetPath = opts.storageDir
      }
    }
    this.offsetPath = `${this.offsetPath}/${this.jwt.appID}:${this.jwt.deviceID}.offset`
    this.logger = logging.getLogger('core.self-sdk')
  }

  public static build(
    url: string,
    jwt: Jwt,
    is: IdentityService,
    ec: Crypto,
    opts?: { storageDir?: string }
  ): Messaging {
    let ms = new Messaging(url, jwt, is, ec, opts)

    return ms
  }

  public async start() {
    this.connect()
    await this.setup()
  }

  private async setup() {
    this.logger.debug('setting up messaging')

    await this.wait_for_connection()
    await this.authenticate()
  }

  private async processIncommingMessage(ciphertext: Uint8Array, offset: number, sender: string) {
    try {
      let issuer = sender.split(':')

      let plaintext = await this.encryptionClient.decrypt(ciphertext, issuer[0], issuer[1])
      let payload = JSON.parse(plaintext)
      this.logger.debug(`decoding ${plaintext}`)

      const decode = (str: string): string => Buffer.from(str, 'base64').toString('binary')
      let header = JSON.parse(decode(payload['protected']))
      let k = await this.is.publicKey(issuer[0], header['kid'])

      this.logger.debug(`verifying message signature`)
      if (!this.jwt.verify(payload, k)) {
        this.logger.info(`received unverified message ${payload.cid}`)
        return
      }

      this.setOffset(offset)
      this.logger.debug(`received payload ${payload['payload']}`)
      let p = JSON.parse(Buffer.from(payload['payload'], 'base64').toString('utf8'))
      this.logger.debug(`processing ${p.typ}`)
      switch (p.typ) {
        case 'identities.facts.query.resp': {
          await this.processResponse(p, 'identities.facts.query.resp', plaintext)
          break
        }
        case 'identities.authenticate.resp': {
          await this.processResponse(p, 'identities.authenticate.resp', plaintext)
          break
        }
        case 'document.sign.resp': {
          await this.processResponse(p, 'document.sign.resp', plaintext)
          break
        }
        default: {
          if (this.callbacks.has(p.typ)) {
            let fn = this.callbacks.get(p.typ)
            fn(p)
          } else {
            this.logger.debug(`no callbacks setup ${p.typ}`)
          }
          break
        }
      }
    } catch (error) {
      this.logger.info(`skipping message due ${error}`)
    }
  }

  private async processResponse(payload: any, typ: string, input: string) {
    let res = await this.buildResponse(payload, input)

    if (this.requests.has(payload.cid)) {
      let r = this.requests.get(payload.cid)
      r.response = res
      r.responded = true
      this.requests.set(payload.cid, r)
    } else if (this.callbacks.has(typ)) {
      let fn = this.callbacks.get(typ)
      fn(res)
    }
  }

  private async buildResponse(payload: any, input: string): Promise<any> {
    if (payload.typ === 'identities.facts.query.resp') {
      return FactResponse.parse(payload, this.jwt, this.is)
    }
    payload["input"] = input
    return payload
  }

  private processIncommingACL(id: string, msg: string) {
    let list = JSON.parse(msg)
    let req = this.requests.get(id)
    if (!req) {
      this.logger.debug(`ACL request not found ${id}`)
      return
    }

    req.response = list
    req.responded = true
    req.acknowledged = true // acls list does not respond with ACK
    this.requests.set(id, req)
  }

  close() {
    if (this.connected) {
      this.connected = false
      this.ws.close()
    }
  }

  private async onmessage(hdr: header.SelfMessaging.Header, data: Uint8Array) {
    this.logger.debug(`received ${hdr.id()} (${hdr.msgtype()})`)
    switch (hdr.msgtype()) {
      case mtype.SelfMessaging.MsgType.ERR: {
        let buf = new flatbuffers.ByteBuffer(data)
        let ntf = notification.SelfMessaging.Notification.getRootAsNotification(buf);

        let sw = 0
        Array.from(this.requests.keys()).forEach(key => {
          if (this.requests.get(key).uuid == ntf.id()) {
            let r = this.requests.get(key)
            r.response = { errorMessage: ntf.error() }
            r.acknowledged = true
            r.responded = true
            this.requests.set(key, r)
            sw = 1
          }
        })

        if (sw == 1) {
          break
        }

        this.logger.debug("error message received")
        this.logger.warn(ntf.error());
        break
      }
      case mtype.SelfMessaging.MsgType.ACK: {
        this.mark_as_acknowledged(hdr.id())
        break
      }
      case mtype.SelfMessaging.MsgType.ACL: {
        let buf = new flatbuffers.ByteBuffer(data)
        let resp = acl.SelfMessaging.ACL.getRootAsACL(buf)

        this.processIncommingACL(resp.id(), Buffer.from(resp.payloadArray()).toString())
        break
      }
      case mtype.SelfMessaging.MsgType.MSG: {
        let buf = new flatbuffers.ByteBuffer(data)
        let msg = message.SelfMessaging.Message.getRootAsMessage(buf);
        this.logger.debug(`message "${hdr.id()}" received from ${msg.sender()}`)

        await this.processIncommingMessage(
          Buffer.from(msg.ciphertextArray()),
          // TODO : this will overflow at 1<<32 - 1
          // we should treat this as a 64 bit int
          msg.metadata(null).offset().low,
          msg.sender()
        )
        break
      }
    }
  }

  /* istanbul ignore next */
  private connect() {
    this.logger.debug(`configuring websockets`)
    if (this.ws === undefined) {
      const WebSocket = require('ws')
      this.ws = new WebSocket(this.url)
    }

    this.ws.onopen = () => {
      this.logger.debug(`connected`)
      this.connected = true
    }

    this.ws.onclose = () => {
      // If is not manually closed try to reconnect
      if (this.connected === true) {
        this.connected = false;
        this.logger.debug(`reconnecting...`)
        this.ws = undefined
        if (this.url !== '') {
          this.connect()
        }

        this.setup()
      }
    }

    this.ws.onmessage = async event => {
      let buf = new flatbuffers.ByteBuffer(event.data)
      let hdr = header.SelfMessaging.Header.getRootAsHeader(buf)
      await this.onmessage(hdr, event.data)
    }
  }

  private async authenticate() {
    let id = uuidv4()
    let token = this.jwt.authToken()

    let builder = new flatbuffers.Builder(1024)

    let rid = builder.createString(id)
    let tkn = builder.createString(token)
    let did = builder.createString(this.jwt.deviceID)

    auth.SelfMessaging.Auth.startAuth(builder)
    auth.SelfMessaging.Auth.addId(builder, rid)
    auth.SelfMessaging.Auth.addMsgtype(builder, mtype.SelfMessaging.MsgType.AUTH)
    auth.SelfMessaging.Auth.addDevice(builder, did)
    auth.SelfMessaging.Auth.addToken(builder, tkn)
    auth.SelfMessaging.Auth.addOffset(builder, flatbuffers.createLong(this.getOffset(), 0))
    let authReq = auth.SelfMessaging.Auth.endAuth(builder)

    builder.finish(authReq)

    let buf = builder.asUint8Array()

    await this.send_and_wait(id, {
      data: buf,
      uuid: id
    })
  }

  async send_and_wait(id: string, request: Request): Promise<Response | boolean> {
    if (!request.acknowledged) {
      request.acknowledged = false
    }
    if (!request.waitForResponse) {
      request.waitForResponse = false
    }
    if (!request.responded) {
      request.responded = false
    }
    if (!request.timeout) {
      request.timeout = Date.now() + defaultRequestTimeout
    }

    this.send(id, request)
    return this.wait(id, request)
  }

  async request(
    id: string,
    uuid: string,
    data: string | ArrayBuffer | SharedArrayBuffer | Blob | ArrayBufferView | Array<string>
  ): Promise<any> {
    return this.send_and_wait(id, {
      data: data,
      uuid: uuid,
      waitForResponse: true
    })
  }

  send(id: string, request: Request) {
    if (!Array.isArray(request.data)) {
      this.ws.send(request.data)
    } else {
      for (var i = 0; i < request.data.length; i++) {
        this.ws.send(request.data[i])
      }
    }

    this.requests.set(id, request)
  }

  private async wait(id: string, request: Request): Promise<Response | boolean> {
    // TODO (adriacidre) this methods should manage a waiting timeout.
    // TODO () ACK is based on JTI while Response on CID!!!!
    if (!request.waitForResponse) {
      this.logger.debug(`waiting for acknowledgement`)
      request.acknowledged = await this.wait_for_ack(id)
      this.logger.debug(`do not need to wait for response`)
      return request.acknowledged
    }
    await this.wait_for_response(id)
    if (request.response) {
      this.logger.debug(`response received`)
    }

    return request.response
  }

  private wait_for_ack(id: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      while (this.requests.has(id)) {
        let req = this.requests.get(id)
        if (req && req.acknowledged) {
          resolve(true)
          break
        }
        await this.delay(100)
      }
      resolve(true)
    })
  }

  private wait_for_response(id: string): Promise<Response | undefined> {
    this.logger.debug(`waiting for response ${id}`)
    return new Promise(async (resolve, reject) => {
      while (this.requests.has(id)) {
        let req = this.requests.get(id)
        if (req && req.timeout <= Date.now()) {
          resolve(undefined)
          break
        }
        if (req && req.response) {
          resolve(req.response)
          break
        }
        await this.delay(100)
      }
      resolve(undefined)
    })
  }

  private wait_for_connection(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      while (!this.connected) {
        this.logger.debug("waiting for connection")
        await this.delay(100)
      }
      resolve(true)
    })
  }

  private mark_as_acknowledged(id: string) {
    let req = this.requests.get(id)
    if (req) {
      req.acknowledged = true
      this.requests.set(id, req)
    }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  subscribe(messageType: string, callback: (n: any) => any) {
    this.callbacks.set(messageType, callback)
  }

  private getOffset(): number {
    try {
      let offset = fs.readFileSync(this.offsetPath, { flag: 'r' })
      return parseInt(offset.toString(), 10)
    } catch (error) {
      return 0
    }
  }

  private setOffset(offset: number) {
    this.jwt.stateManager.write(this.offsetPath, offset.toString())
  }

  // hasSession checks if a session with a specific identifier and device has already been
  // initialised.
  public hasSession(identifier: string, device: string): boolean {
    let path = this.encryptionClient.sessionPath(identifier, device)
    return this.jwt.stateManager.exists(path)
  }
}
