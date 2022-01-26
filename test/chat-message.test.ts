// Copyright 2020 Self Group Ltd. All Rights Reserved.

import ChatService from '../src/chat-service';
import IdentityService from '../src/identity-service';
import Jwt from '../src/jwt';
import Messaging from '../src/messaging'
import MessagingService from '../src/messaging-service';
import { WebSocket, Server } from 'mock-socket'
import EncryptionMock from './mocks/encryption-mock'
import { ChatMessage } from '../src/chat-message';

describe("chat-service", () => {
  let cs: ChatService
  let ms: Messaging
  let mss: MessagingService
  let is: IdentityService
  let jwt: Jwt
  let mockServer: Server
  let recipient = "me"
  let payload = {
    iss: "iss",
    msg: "body",
    jti: "jti",
    gid: "gid"
  }

  beforeEach(async () => {

    let pk = 'UZXk4PSY6LN29R15jUVuDabsoH7VhFkVWGApA0IYLaY'
    let sk = '1:GVV4WqN6qQdfD7VQYV/VU7/9CTmWceXtSN4mykhzk7Q'
    jwt = await Jwt.build('appID', sk, { ntp: false })

    let is = new IdentityService(jwt, 'https://api.joinself.com/')

    const fakeURL = 'ws://localhost:8080'
    mockServer = new Server(fakeURL)

    let ec = new EncryptionMock()
    ms = new Messaging('', jwt, is, ec)

    ms.ws = new WebSocket(fakeURL)
    ms.connected = true
    mss = new MessagingService(jwt, ms, is, ec)

    cs = new ChatService(mss, is)
  })

  afterEach(async () => {
    jwt.stop()
    mockServer.close()
  })


  describe("ChatMessage::constructor", () => {
  it('should construct a basic object for one recipient', async () => {
      let cm = new ChatMessage(cs, recipient, payload)
      expect(cm.recipients).toEqual([recipient])
      expect(cm.payload).toEqual(payload)
      expect(cm.iss).toEqual(payload.iss)
      expect(cm.body).toEqual(payload.msg)
      expect(cm.jti).toEqual(payload.jti)
      expect(cm.gid).toEqual(payload.gid)
    })

    it('should construct a basic object for multiple recipient', async () => {
      let recipients = ["me", "you"]
      let cm = new ChatMessage(cs, recipients, payload)
      expect(cm.recipients).toEqual(recipients)
      expect(cm.payload).toEqual(payload)
      expect(cm.iss).toEqual(payload.iss)
      expect(cm.body).toEqual(payload.msg)
      expect(cm.jti).toEqual(payload.jti)
      expect(cm.gid).toEqual(payload.gid)
    })
  })

  describe("ChatMessage::delete", () => {
    it('should call delete on ChatService', async () =>{
      const chatMock = jest.spyOn(cs, 'delete').mockImplementation(
        async (to: string|string[], cids: string|string[], gid?: string ) => {
          expect(to).toEqual([recipient])
          expect(cids).toEqual(payload.jti)
          expect(gid).toEqual(payload.gid)
        }
      )
      let cm = new ChatMessage(cs, recipient, payload)
      await cm.delete()
    })
  })

  describe("ChatMessage::edit", () => {
    it('should call edit on ChatService', async () =>{
      let newBody = "new body"
      const chatMock = jest.spyOn(cs, 'edit').mockImplementation(
        async (to: string|string[], cid: string, body: string, gid?: string ) => {
          expect(to).toEqual([recipient])
          expect(cid).toEqual(payload.jti)
          expect(body).toEqual(newBody)
          expect(gid).toEqual(payload.gid)
        }
      )
      let cm = new ChatMessage(cs, recipient, payload)
      await cm.edit(newBody)
      expect(cm.body).toEqual(newBody)
    })

    it("should do nothing if I'm the issuer of that message", async () =>{
      const chatMock = jest.spyOn(cs, 'edit')
      expect(chatMock).not.toHaveBeenCalled()

      cs.is.jwt.appID = "me"

      let cm = new ChatMessage(cs, recipient, payload)
      let newBody = "new body"
      await cm.edit(newBody)
      expect(cm.body).toEqual(payload.msg)
    })
})

  describe("ChatMessage::markAsDelivered", () => {
    it('should call delivered on ChatService', async () =>{
      const chatMock = jest.spyOn(cs, 'delivered').mockImplementation(
        async (to: string|string[], cids: string|string[], gid?: string ) => {
          expect(to).toEqual([recipient])
          expect(cids).toEqual(payload.jti)
          expect(gid).toEqual(payload.gid)
        }
      )
      let cm = new ChatMessage(cs, recipient, payload)
      await cm.markAsDelivered()
    })

    it("should do nothing if I'm the issuer of that message", async () =>{
      const chatMock = jest.spyOn(cs, 'delivered')
      expect(chatMock).not.toHaveBeenCalled()

      cs.is.jwt.appID = "not-me"

      let cm = new ChatMessage(cs, recipient, payload)
      await cm.markAsDelivered()
    })
  })

  describe("ChatMessage::markAsRead", () => {
    it('should call read on ChatService', async () =>{
      const chatMock = jest.spyOn(cs, 'read').mockImplementation(
        async (to: string|string[], cids: string|string[], gid?: string ) => {
          expect(to).toEqual([recipient])
          expect(cids).toEqual(payload.jti)
          expect(gid).toEqual(payload.gid)
        }
      )
      let cm = new ChatMessage(cs, recipient, payload)
      await cm.markAsRead()
    })

    it("should do nothing if I'm the issuer of that message", async () =>{
      const chatMock = jest.spyOn(cs, 'read')
      expect(chatMock).not.toHaveBeenCalled()

      cs.is.jwt.appID = "not-me"

      let cm = new ChatMessage(cs, recipient, payload)
      await cm.markAsRead()
    })
  })

  describe("ChatMessage::respond", () => {
    it('should call message on ChatService', async () =>{
      let body = "new body"
      const chatMock = jest.spyOn(cs, 'message').mockImplementation(
        async (to: string|string[], b: string, opts?: any ): Promise<ChatMessage> => {
          expect(to).toEqual([recipient])
          expect(b).toEqual(body)
          expect(opts.rid).toEqual(payload.jti)

          return new Promise(resolve => {
            resolve(new ChatMessage(cs, recipient, payload))
          })
        }
      )
      let cm = new ChatMessage(cs, recipient, payload)
      await cm.respond(body)
    })
  })

  describe("ChatMessage::message", () => {
    it('should call message on ChatService', async () =>{
      let body = "new body"
      const chatMock = jest.spyOn(cs, 'message').mockImplementation(
        async (to: string|string[], b: string, opts?: any ): Promise<ChatMessage> => {
          expect(to).toEqual([recipient])
          expect(b).toEqual(body)
          expect(opts.aud).toEqual(payload.gid)
          expect(opts.gid).toEqual(payload.gid)

          return new Promise(resolve => {
            resolve(new ChatMessage(cs, recipient, payload))
          })
        }
      )
      let cm = new ChatMessage(cs, recipient, payload)
      await cm.respond(body)
    })
  })
})
