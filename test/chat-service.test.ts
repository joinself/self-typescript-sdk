// Copyright 2020 Self Group Ltd. All Rights Reserved.

import ChatService from '../src/chat-service';
import IdentityService from '../src/identity-service';
import Jwt from '../src/jwt';
import Messaging from '../src/messaging'
import MessagingService from '../src/messaging-service';
import { WebSocket, Server } from 'mock-socket'
import EncryptionMock from './mocks/encryption-mock'

describe("chat-service", () => {
  let cs: ChatService
  let ms: Messaging
  let mss: MessagingService
  let is: IdentityService
  let jwt: Jwt
  let mockServer: Server

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


  describe("ChatService::read", () => {
    it('should send a chat.message.read', async () => {
      let recipients = ["a", "b", "c"]
      let cids = ["cid1"]

      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload) => {
          expect(to).toEqual(recipients)
          expect(payload.typ).toEqual('chat.message.read')
          expect(payload.cids).toEqual(cids)
          expect(payload.gid).toEqual(undefined)
        }
      )

      await cs.read(recipients, cids)
    })

    it('should send a chat.message.read as group message', async () => {
      let recipients = ["a", "b", "c"]
      let cids = ["cid1"]

      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload) => {
          expect(to).toEqual(recipients)
          expect(payload.typ).toEqual('chat.message.read')
          expect(payload.cids).toEqual(cids)
          expect(payload.gid).toEqual("gid")
        }
      )

      await cs.read(recipients, cids, "gid")
    })
  })

  describe("ChatService::delivered", () => {
    it('should send a chat.message.delivered', async () => {
      let recipients = ["a", "b", "c"]
      let cids = ["cid1"]

      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload) => {
          expect(to).toEqual(recipients)
          expect(payload.typ).toEqual('chat.message.delivered')
          expect(payload.cids).toEqual(cids)
          expect(payload.gid).toEqual(undefined)
        }
      )

      await cs.delivered(recipients, cids)
    })

    it('should send a chat.message.delivered as group message', async () => {
      let recipients = ["a", "b", "c"]
      let cids = ["cid1"]

      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload) => {
          expect(to).toEqual(recipients)
          expect(payload.typ).toEqual('chat.message.delivered')
          expect(payload.cids).toEqual(cids)
          expect(payload.gid).toEqual("gid")
        }
      )

      await cs.delivered(recipients, cids, "gid")
    })
  })

  describe("ChatService::edit", () => {
    it('should send a chat.message.edit', async () => {
      let recipients = ["a", "b", "c"]
      let cid = "cid1"
      let body = "body"

      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload) => {
          expect(to).toEqual(recipients)
          expect(payload.typ).toEqual('chat.message.edit')
          expect(payload.cid).toEqual(cid)
          expect(payload.msg).toEqual(body)
          expect(payload.gid).toEqual(undefined)
        }
      )

      await cs.edit(recipients, cid, body)
    })

    it('should send a chat.message.delete when group is provided', async () => {
      let recipients = ["a", "b", "c"]
      let cid = "cid1"
      let body = "body"

      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload) => {
          expect(to).toEqual(recipients)
          expect(payload.typ).toEqual('chat.message.edit')
          expect(payload.cid).toEqual(cid)
          expect(payload.msg).toEqual(body)
          expect(payload.gid).toEqual("gid")
        }
      )

      await cs.edit(recipients, cid, body, "gid")
    })
  })

  describe("ChatService::delete", () => {
    it('should send a chat.message.delete', async () => {
      let recipients = ["a", "b", "c"]
      let cids = ["cid1"]

      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload) => {
          expect(to).toEqual(recipients)
          expect(payload.typ).toEqual('chat.message.delete')
          expect(payload.cids).toEqual(cids)
          expect(payload.gid).toEqual(undefined)
        }
      )

      await cs.delete(recipients, cids)
    })

    it('should send a chat.message.delete as group message', async () => {
      let recipients = ["a", "b", "c"]
      let cids = ["cid1"]
      let body = "body"

      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload) => {
          expect(to).toEqual(recipients)
          expect(payload.typ).toEqual('chat.message.delete')
          expect(payload.cids).toEqual(cids)
          expect(payload.gid).toEqual("gid")
        }
      )

      await cs.delete(recipients, cids, "gid")
    })
  })

  describe("ChatService::invite", () => {
    it('should send a chat.invite', async () => {
      let name = "test"
      let members = ["a", "b", "c"]
      let gid = "gid"

      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload) => {
          expect(to).toEqual(members)
          expect(payload.typ).toEqual('chat.invite')
          expect(payload.name).toEqual(name)
          expect(payload.gid).toEqual(gid)
          expect(payload.members).toEqual(members)
          expect(payload.aud).toEqual(gid)
        }
      )

      await cs.invite(gid, name, members)
    })
  })


  describe("ChatService::join", () => {
    it('should send a chat.join', async () => {
      let name = "test"
      let members = ["a", "b", "c"]
      let gid = "gid"

      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload) => {
          expect(to).toEqual(members)
          expect(payload.typ).toEqual('chat.join')
          expect(payload.gid).toEqual(gid)
          expect(payload.aud).toEqual(gid)
        }
      )

      let membersCall = 0
      const msMockPermit = jest.spyOn(mss, 'permitConnection').mockImplementation(
        async (member): Promise<boolean|Response> => {
          expect(member).toContainEqual(members[membersCall])
          membersCall = membersCall + 1

          return new Promise(resolve => {
            resolve(true)
          })
        }
      )

      await cs.join(gid, members)
    })
  })

  describe("ChatService::leave", () => {
    it('should send a chat.remove', async () => {
      let members = ["a", "b", "c"]
      let gid = "gid"

      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload) => {
          expect(to).toEqual(members)
          expect(payload.typ).toEqual('chat.remove')
          expect(payload.gid).toEqual(gid)
        }
      )

      await cs.leave(gid, members)
    })
  })


})
