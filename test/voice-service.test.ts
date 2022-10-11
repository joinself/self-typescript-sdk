// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from '../src/jwt'
import IdentityService from '../src/identity-service'
import Messaging from '../src/messaging'
import MessagingService from '../src/messaging-service'
import DocsService from '../src/docs-service';

import { WebSocket, Server } from 'mock-socket'
import EncryptionMock from './mocks/encryption-mock'
import VoiceService from '../src/voice-service';


/**
 * Attestation test
 */
describe('VoiceService', () => {
  let vs: VoiceService
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

    vs = new VoiceService(mss)
  })

  afterEach(async () => {
    jwt.stop()
    mockServer.close()
  })


  describe('VoiceService.setup', async () => {
    it('should send a chat.voice.setup', async () => {
      let recipient = 'a'
      let name = 'name'
      let cid = 'cid'
      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload, opts) => {
          expect(to).toEqual([recipient])
          expect(cid).toEqual(cid)
          expect(payload.typ).toEqual('chat.voice.setup')
          expect(payload.data["name"]).toEqual(name)
        }
      )

      await vs.setup(recipient, name, cid)
    })
  })

  describe('VoiceService::onSetup', () => {
    it('happy path', async () => {
      const msMock = jest.spyOn(mss, 'subscribe').mockImplementation(
        (messageType: string, callback: (n: any) => any) => {
          expect(messageType).toEqual('chat.voice.setup')
        })

      expect(vs.onSetup((n: any): any => {})).toBeUndefined()
    })
  })

  describe('VoiceService.start', async () => {
    it('should send a chat.voice.start', async () => {
      let recipient = 'a'
      let cid = 'cid'
      let callID = 'call_id'
      let peerInfo = 'peer_info'
      let data = {}
      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload, opts) => {
          expect(to).toEqual([recipient])
          expect(payload.typ).toEqual('chat.voice.start')
          expect(payload.cid).toEqual(cid)
          expect(payload['call_id']).toEqual(callID)
          expect(payload['peer_info']).toEqual(peerInfo)
          expect(payload['data']).toEqual(data)
        }
      )

      await vs.start(recipient, cid, callID, peerInfo, data)
    })
  })

  describe('VoiceService::onStart', () => {
    it('happy path', async () => {
      const msMock = jest.spyOn(mss, 'subscribe').mockImplementation(
        (messageType: string, callback: (n: any) => any) => {
          expect(messageType).toEqual('chat.voice.start')
        })

      expect(vs.onStart((n: any): any => {})).toBeUndefined()
    })
  })

  describe('VoiceService.accept', async () => {
    it('should send a chat.voice.accept', async () => {
      let recipient = 'a'
      let cid = 'cid'
      let callID = 'call_id'
      let peerInfo = 'peer_info'
      let data = {}
      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload, opts) => {
          expect(to).toEqual([recipient])
          expect(payload.typ).toEqual('chat.voice.accept')
          expect(payload.cid).toEqual(cid)
          expect(payload['call_id']).toEqual(callID)
          expect(payload['peer_info']).toEqual(peerInfo)
          expect(payload['data']).toEqual(data)
        }
      )

      await vs.accept(recipient, cid, callID, peerInfo, data)
    })
  })

  describe('VoiceService::onAccept', () => {
    it('happy path', async () => {
      const msMock = jest.spyOn(mss, 'subscribe').mockImplementation(
        (messageType: string, callback: (n: any) => any) => {
          expect(messageType).toEqual('chat.voice.accept')
        })

      expect(vs.onAccept((n: any): any => {})).toBeUndefined()
    })
  })

  describe('VoiceService.stop', async () => {
    it('should send a chat.voice.stop', async () => {
      let recipient = 'a'
      let cid = 'cid'
      let callID = 'callID'
      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload, opts) => {
          expect(to).toEqual([recipient])
          expect(cid).toEqual(cid)
          expect(payload.typ).toEqual('chat.voice.stop')
          expect(payload["call_id"]).toEqual(callID)
        }
      )

      await vs.stop(recipient, cid, callID)
    })
  })

  describe('VoiceService::onStop', () => {
    it('happy path', async () => {
      const msMock = jest.spyOn(mss, 'subscribe').mockImplementation(
        (messageType: string, callback: (n: any) => any) => {
          expect(messageType).toEqual('chat.voice.stop')
        })

      expect(vs.onStop((n: any): any => {})).toBeUndefined()
    })
  })

  describe('VoiceService.busy', async () => {
    it('should send a chat.voice.busy', async () => {
      let recipient = 'a'
      let cid = 'cid'
      let callID = 'callID'
      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload, opts) => {
          expect(to).toEqual([recipient])
          expect(cid).toEqual(cid)
          expect(payload.typ).toEqual('chat.voice.busy')
          expect(payload["call_id"]).toEqual(callID)
        }
      )

      await vs.busy(recipient, cid, callID)
    })
  })

  describe('VoiceService::onBusy', () => {
    it('happy path', async () => {
      const msMock = jest.spyOn(mss, 'subscribe').mockImplementation(
        (messageType: string, callback: (n: any) => any) => {
          expect(messageType).toEqual('chat.voice.busy')
        })

      expect(vs.onBusy((n: any): any => {})).toBeUndefined()
    })
  })


  describe('VoiceService.summary', async () => {
    it('should send a chat.voice.summary', async () => {
      let recipient = 'a'
      let cid = 'cid'
      let callID = 'callID'
      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload, opts) => {
          expect(to).toEqual([recipient])
          expect(cid).toEqual(cid)
          expect(payload.typ).toEqual('chat.voice.summary')
          expect(payload["call_id"]).toEqual(callID)
        }
      )

      await vs.summary(recipient, cid, callID)
    })
  })

  describe('VoiceService::onSummary', () => {
    it('happy path', async () => {
      const msMock = jest.spyOn(mss, 'subscribe').mockImplementation(
        (messageType: string, callback: (n: any) => any) => {
          expect(messageType).toEqual('chat.voice.summary')
        })

      expect(vs.onSummary((n: any): any => {})).toBeUndefined()
    })
  })


})
