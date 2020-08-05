import Jwt from './jwt'
import IdentityService from './identity-service'

import { Auth } from '../generated/auth_pb'
import { MsgType } from '../generated/msgtype_pb'
import { Message } from '../generated/message_pb'
import FactResponse from './fact-response'

export interface Request {
  data: string | ArrayBuffer | SharedArrayBuffer | Blob | ArrayBufferView
  acknowledged?: boolean
  waitForResponse?: boolean
  responded?: boolean
  response?: any
}

export default class Messaging {
  url: string
  jwt: Jwt
  ws: WebSocket
  connected: boolean
  requests: Map<string, Request>
  callbacks: Map<string, (n: any) => any>
  is: IdentityService

  constructor(url: string, jwt: Jwt, is: IdentityService) {
    this.jwt = jwt
    this.url = url
    this.requests = new Map()
    this.callbacks = new Map()
    this.connected = false
    this.is = is

    if (this.url !== '') {
      this.connect()
    }
  }

  public static async build(url: string, jwt: Jwt, is: IdentityService): Promise<Messaging> {
    let ms = new Messaging(url, jwt, is)

    await ms.setup()

    return ms
  }

  private async setup() {
    console.log('setting up')
    await this.wait_for_connection()
    await this.authenticate()
  }

  private async processIncommingMessage(input: string) {
    try {
      let ciphertext = JSON.parse(Buffer.from(input, 'base64').toString())
      let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())

      let pks = await this.is.publicKeys(payload.iss)
      if (!this.jwt.verify(ciphertext, pks[0].key)) {
        console.log('unverified message ' + payload.cid)
        return
      }

      switch (payload.typ) {
        case 'identities.facts.query.resp': {
          await this.processResponse(payload, 'identities.facts.query.resp')
          break
        }
        case 'identities.authenticate.resp': {
          await this.processResponse(payload, 'identities.authenticate.resp')
          break
        }
      }
    } catch (error) {
      console.log('skipping message')
    }
  }

  private async processResponse(payload: any, typ: string) {
    let res = await this.buildResponse(payload)

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

  private async buildResponse(payload: any): Promise<any> {
    if (payload.typ === 'identities.facts.query.resp') {
      return FactResponse.parse(payload, this.jwt, this.is)
    }
    return payload
  }

  private processIncommingACL(id: string, msg: string) {
    let list = JSON.parse(msg)
    let req = this.requests.get(id)
    if (!req) {
      console.debug(`ACL request not found ${id}`)
      return
    }

    req.response = list
    req.responded = true
    req.acknowledged = true // acls list does not respond with ACK
    this.requests.set(id, req)
  }

  close() {
    this.ws.close()
  }

  private connect() {
    if (this.ws === undefined) {
      const WebSocket = require('ws')
      this.ws = new WebSocket(this.url)
    }

    this.ws.onopen = async () => {
      this.connected = true
    }

    this.ws.onclose = () => {
      this.connected = false
    }

    this.ws.onmessage = async input => {
      let msg = Message.deserializeBinary(input.data)
      console.log(`received ${msg.getId()} (${msg.getType()})`)
      switch (msg.getType()) {
        case MsgType.ERR: {
          console.log(`error processing ${msg.getId()}`)
          console.log(msg)
          break
        }
        case MsgType.ACK: {
          console.log(`acknowledged ${msg.getId()}`)
          this.mark_as_acknowledged(msg.getId())
          break
        }
        case MsgType.ACL: {
          console.log(`ACL ${msg.getId()}`)
          this.processIncommingACL(msg.getId(), msg.getRecipient())
          break
        }
        case MsgType.MSG: {
          console.log(`message received ${msg.getId()}`)
          await this.processIncommingMessage(msg.getCiphertext_asB64())
          break
        }
        default: {
          console.log('invalid message')
          break
        }
      }
    }
  }

  private async authenticate() {
    let token = this.jwt.authToken()

    const msg = new Auth()
    msg.setType(MsgType.AUTH)
    msg.setId('authentication')
    msg.setToken(token)
    msg.setDevice(this.jwt.deviceID)

    await this.send_and_wait(msg.getId(), {
      data: msg.serializeBinary()
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
    this.send(id, request)
    return this.wait(id, request)
  }

  async request(
    id: string,
    data: string | ArrayBuffer | SharedArrayBuffer | Blob | ArrayBufferView
  ): Promise<any> {
    return this.send_and_wait(id, {
      data: data,
      waitForResponse: true
    })
  }

  private send(id: string, request: Request) {
    this.ws.send(request.data)

    this.requests.set(id, request)
  }

  private async wait(id: string, request: Request): Promise<Response | boolean> {
    // TODO (adriacidre) this methods should manage a waiting timeout.
    // TODO () ACK is based on JTI while Response on CID!!!!
    if (!request.waitForResponse) {
      console.log('waiting for acknowledgement')
      request.acknowledged = await this.wait_for_ack(id)
      console.log('do not need to wait for response')
      return request.acknowledged
    }
    console.log('waiting for response')
    await this.wait_for_response(id)
    console.log('responded')

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
    console.log(`waiting for response ${id}`)
    return new Promise(async (resolve, reject) => {
      while (this.requests.has(id)) {
        let req = this.requests.get(id)
        if (req && req.response) {
          resolve(req.response)
          break
        }
        await this.delay(100)
      }
      resolve()
    })
  }

  private wait_for_connection(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      while (!this.connected) {
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
}
