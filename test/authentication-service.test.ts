// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from '../src/jwt'
import IdentityService from '../src/identity-service'
import AuthenticationService from '../src/authentication-service'
import Messaging from '../src/messaging'
import MessagingService from '../src/messaging-service'

import { WebSocket, Server } from 'mock-socket'
import * as message from '../src/msgproto/message_generated'
import * as mtype from '../src/msgproto/types_generated'
import Crypto from '../src/crypto'
import EncryptionMock from './mocks/encryption-mock'

import * as flatbuffers from 'flatbuffers'
import Requester from '../src/requester';

/**
 * Attestation test
 */
describe('AuthenticationService', () => {
  let r: Requester
  let auth: AuthenticationService
  let jwt: Jwt
  let ms: Messaging
  let is: IdentityService
  let messagingService: MessagingService
  let mockServer: Server
  let URL = require('url').URL
  let ec: Crypto

  beforeEach(async () => {
    let pk = 'UZXk4PSY6LN29R15jUVuDabsoH7VhFkVWGApA0IYLaY'
    let sk = '1:GVV4WqN6qQdfD7VQYV/VU7/9CTmWceXtSN4mykhzk7Q'
    jwt = await Jwt.build('appID', sk, { ntp: false })
    is = new IdentityService(jwt, 'https://api.joinself.com/')
    ec = new EncryptionMock()

    const fakeURL = 'ws://localhost:8080'
    mockServer = new Server(fakeURL)

    ms = new Messaging('', jwt, is, ec)
    ms.ws = new WebSocket(fakeURL)
    ms.connected = true
    messagingService = new MessagingService(jwt, ms, is, ec)

    r = new Requester(jwt, messagingService, is, ec, 'test')
    auth = new AuthenticationService(r)

    /*
    jest.spyOn(auth, 'fixEncryption').mockImplementation((msg: string): any => {
      return msg
    })
    */
  })

  afterEach(async () => {
    jwt.stop()
    mockServer.close()
  })

  describe('AuthenticationService::request', () => {
    let history = require('./__fixtures__/valid_custom_device_entry.json')
    it('happy path', async () => {
      const axios = require('axios')

      jest.mock('axios')
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: ['cjK0uSMXQjKeaKGaibkVGZ']
      })
      jest.spyOn(is, 'app').mockImplementation(
        (appID: string): Promise<any> => {
          return new Promise(resolve => {
            resolve({ paid_actions: true })
          })
        }
      )
      jest.spyOn(messagingService, 'isPermited').mockImplementation(
        (selfid: string): Promise<Boolean> => {
          return new Promise(resolve => {
            resolve(true)
          })
        }
      )

      const msMock = jest.spyOn(ms, 'request').mockImplementation(
        (cid: string, uuid: string, data): Promise<any> => {
          // The cid is automatically generated
          expect(cid.length).toEqual(36)
          // The cid is automatically generated
          let buf = new flatbuffers.ByteBuffer(data[0].valueOf() as Uint8Array)
          let msg = message.SelfMessaging.Message.getRootAsMessage(buf);

          // Envelope
          expect(msg.id().length).toEqual(36)
          expect(msg.recipient()).toEqual('26742678155:cjK0uSMXQjKeaKGaibkVGZ')
          expect(msg.sender()).toEqual('appID:1')
          expect(msg.msgtype()).toEqual(mtype.SelfMessaging.MsgType.MSG)

          // Check ciphertext
          let input = msg.ciphertextArray()
          let ciphertext = JSON.parse(Buffer.from(input).toString())
          let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
          expect(payload.typ).toEqual('identities.facts.query.req')
          expect(payload.iss).toEqual('appID')
          expect(payload.sub).toEqual('26742678155')
          expect(payload.aud).toEqual('26742678155')
          expect(payload.cid).toEqual(cid)
          expect(payload.jti.length).toEqual(36)

          return new Promise(resolve => {
            resolve({ status: 'accepted' })
          })
        }
      )

      let res = await auth.request('26742678155')
      expect(res).toBeTruthy()
    })

    it('fails when not enough credits', async () => {
      const axios = require('axios')
      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: ['deviceID']
      })
      jest.spyOn(is, 'app').mockImplementation(
        (appID: string): Promise<any> => {
          return new Promise(resolve => {
            resolve({ paid_actions: false })
          })
        }
      )
      jest.spyOn(is, 'app').mockImplementation(
        (appID: string): Promise<any> => {
          return new Promise(resolve => {
            resolve({ paid_actions: false })
          })
        }
      )

      await expect(auth.request('selfid')).rejects.toThrowError(
        'Your credits have expired, please log in to the developer portal and top up your account.'
      )
    })

    it('fails when callback connection is not permitted', async () => {
      const axios = require('axios')
      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: ['deviceID']
      })

      jest.spyOn(is, 'app').mockImplementation(
        (appID: string): Promise<any> => {
          return new Promise(resolve => {
            resolve({ paid_actions: true })
          })
        }
      )

      jest.spyOn(messagingService, 'isPermited').mockImplementation(
        (selfid: string): Promise<Boolean> => {
          return new Promise(resolve => {
            resolve(false)
          })
        }
      )

      await expect(auth.request('selfid')).rejects.toThrowError(
        "You're not permitting connections from selfid"
      )
    })

    it('rejected auth request', async () => {
      const axios = require('axios')
      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: ['deviceID']
      })
      jest.spyOn(is, 'app').mockImplementation(
        (appID: string): Promise<any> => {
          return new Promise(resolve => {
            resolve({ paid_actions: true })
          })
        }
      )
      jest.spyOn(messagingService, 'isPermited').mockImplementation(
        (selfid: string): Promise<Boolean> => {
          return new Promise(resolve => {
            resolve(true)
          })
        }
      )

      const msMock = jest.spyOn(ms, 'request').mockImplementation(
        (cid: string, uuid: string, data): Promise<any> => {
          return new Promise(resolve => {
            resolve({ status: 'rejected' })
          })
        }
      )

      let res = await auth.request('selfid')
      expect(res.accepted).toBeFalsy()
    })

    it('happy path with custom cid', async () => {
      const axios = require('axios')
      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: ['deviceID']
      })
      jest.spyOn(is, 'app').mockImplementation(
        (appID: string): Promise<any> => {
          return new Promise(resolve => {
            resolve({ paid_actions: true })
          })
        }
      )
      jest.spyOn(messagingService, 'isPermited').mockImplementation(
        (selfid: string): Promise<Boolean> => {
          return new Promise(resolve => {
            resolve(true)
          })
        }
      )

      const msMock = jest.spyOn(ms, 'request').mockImplementation(
        (cid: string, uuid: string, data): Promise<any> => {
          // The cid is automatically generated
          expect(cid).toEqual('cid')
          // The cid is automatically generated
          let buf = new flatbuffers.ByteBuffer(data[0].valueOf() as Uint8Array)
          let msg = message.SelfMessaging.Message.getRootAsMessage(buf)
          let input = msg.ciphertextArray()

          let ciphertext = JSON.parse(Buffer.from(input).toString())
          let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
          expect(payload.cid).toEqual('cid')

          return new Promise(resolve => {
            resolve({ status: 'accepted' })
          })
        }
      )

      let res = await auth.request('selfid', { cid: 'cid' })
      expect(res).toBeTruthy()
    })
  })

  describe('AuthenticationService::generateDeepLink', () => {
    it('happy path', async () => {
      let callback = '0x000x'
      let link = auth.generateDeepLink(callback)
      const url = new URL(link)

      let callbackURL = new URL(url.searchParams.get('link'))
      expect(callbackURL.host).toEqual('developer.test.joinself.com')

      let ciphertext = JSON.parse(
        Buffer.from(callbackURL.searchParams.get('qr'), 'base64').toString()
      )
      let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
      expect(payload.typ).toEqual('identities.facts.query.req')
      expect(payload.iss).toEqual('appID')
      expect(payload.sub).toEqual('-')
      expect(payload.aud).toEqual('-')
      expect(payload.jti.length).toEqual(36)
    })

    it('happy path with custom options', async () => {
      let callback = '0x000x'
      let link = auth.generateDeepLink(callback, { selfid: 'selfid', cid: 'cid' })
      const url = new URL(link)

      let callbackURL = new URL(url.searchParams.get('link'))
      expect(callbackURL.host).toEqual('developer.test.joinself.com')

      let ciphertext = JSON.parse(
        Buffer.from(callbackURL.searchParams.get('qr'), 'base64').toString()
      )
      let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
      expect(payload.typ).toEqual('identities.facts.query.req')
      expect(payload.iss).toEqual('appID')
      expect(payload.sub).toEqual('selfid')
      expect(payload.aud).toEqual('selfid')
      expect(payload.cid).toEqual('cid')
      expect(payload.jti.length).toEqual(36)
    })

    it('happy path for development', async () => {
      let callback = '0x000x'
      r.env = 'development'
      let link = auth.generateDeepLink(callback, { selfid: 'selfid', cid: 'cid' })
      const url = new URL(link)

      let callbackURL = new URL(url.searchParams.get('link'))
      expect(callbackURL.host).toEqual('developer.joinself.com')

      let ciphertext = JSON.parse(
        Buffer.from(callbackURL.searchParams.get('qr'), 'base64').toString()
      )
      let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
      expect(payload.typ).toEqual('identities.facts.query.req')
      expect(payload.iss).toEqual('appID')
      expect(payload.sub).toEqual('selfid')
      expect(payload.aud).toEqual('selfid')
      expect(payload.cid).toEqual('cid')
      expect(payload.jti.length).toEqual(36)
    })

    it('happy path for production', async () => {
      let callback = '0x000x'
      r.env = ''
      let link = auth.generateDeepLink(callback, { selfid: 'selfid', cid: 'cid' })
      const url = new URL(link)

      let callbackURL = new URL(url.searchParams.get('link'))
      expect(callbackURL.host).toEqual('developer.joinself.com')

      let ciphertext = JSON.parse(
        Buffer.from(callbackURL.searchParams.get('qr'), 'base64').toString()
      )
      let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
      expect(payload.typ).toEqual('identities.facts.query.req')
      expect(payload.iss).toEqual('appID')
      expect(payload.sub).toEqual('selfid')
      expect(payload.aud).toEqual('selfid')
      expect(payload.cid).toEqual('cid')
      expect(payload.jti.length).toEqual(36)
    })
  })

  describe('AuthenticationService::generateQR', () => {
    it('happy path', async () => {
      let qr = auth.generateQR()
      expect(qr).not.toBe('')
    })
  })

  describe('AuthenticationService::subscribe', () => {
    it('happy path', async () => {
      const msMock = jest
        .spyOn(ms, 'subscribe')
        .mockImplementation((messageType: string, callback: (n: any) => any) => {
          expect(messageType).toEqual('identities.facts.query.resp')
        })

      expect(auth.subscribe((n: any): any => {})).toBeUndefined()
    })
  })
})
