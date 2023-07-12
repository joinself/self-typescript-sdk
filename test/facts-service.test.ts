// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from '../src/jwt'
import IdentityService from '../src/identity-service'
import Messaging from '../src/messaging'
import FactsService from '../src/facts-service'
import MessagingService from '../src/messaging-service'

import { WebSocket, Server } from 'mock-socket'
import * as message from '../src/msgproto/message'
import * as mtype from '../src/msgproto/msg-type'
import Crypto from '../src/crypto'
import EncryptionMock from './mocks/encryption-mock'

import * as flatbuffers from 'flatbuffers'
import Requester from '../src/requester';
import { FactToIssue, Group } from '../src/facts-service';

/**
 * Attestation test
 */
describe('FactsService', () => {
  let r: Requester
  let fs: FactsService
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
    // ec = new Crypto(is, jwt.deviceID, '/tmp/', sk)

    const fakeURL = 'ws://localhost:8080'
    mockServer = new Server(fakeURL)

    ms = new Messaging('', jwt, is, ec)
    ms.ws = new WebSocket(fakeURL)
    ms.connected = true
    messagingService = new MessagingService(jwt, ms, is, ec)

    r = new Requester(jwt, messagingService, is, ec, 'test')
    fs = new FactsService(r)
    /*
    jest.spyOn(fs, 'fixEncryption').mockImplementation((msg: string): any => {
      return msg
    })
    */
  })

  afterEach(async () => {
    jwt.stop()
    mockServer.close()
  })

  describe('FactsService::request', () => {
    let history = require('./__fixtures__/valid_custom_device_entry.json')
    it('happy path', async () => {
      const axios = require('axios')

      jest.mock('axios')
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: ['cjK0uSMXQjKeaKGaibkVGZ']
      })

      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { id: '26742678155', history: history }
      })

      jest.spyOn(is, 'app').mockImplementation(
        (appID: string): Promise<any> => {
          return new Promise(resolve => {
            resolve({ paid_actions: true })
          })
        }
      )

      const msMock = jest.spyOn(ms, 'request').mockImplementation(
        (cid: string, uuid: string, data): Promise<any> => {
          // The cid is automatically generated
          expect(cid.length).toEqual(36)
          // The cid is automatically generated
          let buf = new flatbuffers.ByteBuffer(data[0].valueOf() as Uint8Array)
          let msg = message.Message.getRootAsMessage(buf);

          // Envelope
          expect(msg.id().length).toEqual(36)
          expect(msg.recipient()).toEqual('26742678155:cjK0uSMXQjKeaKGaibkVGZ')
          expect(msg.sender()).toEqual('appID:1')
          expect(msg.msgtype()).toEqual(mtype.MsgType.MSG)

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
          expect(payload.facts).toEqual([{ fact: 'phone_number' }])

          return new Promise(resolve => {
            resolve({ status: 'accepted' })
          })
        }
      )

      let res = await fs.request('26742678155', [{ fact: 'phone_number' }])
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

      await expect(fs.request('26742678155', [{ fact: 'phone_number' }])).rejects.toThrowError(
        'Your credits have expired, please log in to the developer portal and top up your account.'
      )
    })
  })

  describe('FactsService::requestViaIntermediary', () => {
    it('happy path', async () => {
      const axios = require('axios')
      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: ['deviceID']
      })

      const msMock = jest.spyOn(ms, 'request').mockImplementation(
        (cid: string, uuid: string, data): Promise<any> => {
          // The cid is automatically generated
          expect(cid.length).toEqual(36)
          // The cid is automatically generated
          let buf = new flatbuffers.ByteBuffer(data[0].valueOf() as Uint8Array)
          let msg = message.Message.getRootAsMessage(buf);

          // Envelope
          expect(msg.id().length).toEqual(36)
          expect(msg.recipient()).toEqual('self_intermediary:deviceID')
          expect(msg.sender()).toEqual('appID:1')
          expect(msg.msgtype()).toEqual(mtype.MsgType.MSG)

          // Check ciphertext
          let input = msg.ciphertextArray()
          let ciphertext = JSON.parse(Buffer.from(input).toString())
          let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
          expect(payload.typ).toEqual('identities.facts.query.req')
          expect(payload.iss).toEqual('appID')
          expect(payload.sub).toEqual('selfid')
          expect(payload.aud).toEqual('self_intermediary')
          expect(payload.cid).toEqual(cid)
          expect(payload.jti.length).toEqual(36)
          expect(payload.facts).toEqual([{ fact: 'phone_number' }])

          return new Promise(resolve => {
            resolve({ status: 'accepted' })
          })
        }
      )

      let res = await fs.requestViaIntermediary('selfid', [{ fact: 'phone_number' }])
      expect(res).toBeTruthy()
    })

    it('happy path with custom cid', async () => {
      const axios = require('axios')
      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: ['deviceID']
      })

      const msMock = jest.spyOn(ms, 'request').mockImplementation(
        (cid: string, uuid: string, data): Promise<any> => {
          // The cid is automatically generated
          expect(cid).toEqual('cid')
          // The cid is automatically generated
          let buf = new flatbuffers.ByteBuffer(data[0].valueOf() as Uint8Array)
          let msg = message.Message.getRootAsMessage(buf);

          expect(msg.recipient()).toEqual('intermediary:deviceID')
          let input = msg.ciphertextArray()
          let ciphertext = JSON.parse(Buffer.from(input).toString())
          let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
          expect(payload.cid).toEqual('cid')

          return new Promise(resolve => {
            resolve({ status: 'accepted' })
          })
        }
      )

      let res = await fs.requestViaIntermediary('selfid', [{ fact: 'phone_number' }], {
        cid: 'cid',
        intermediary: 'intermediary'
      })
      expect(res).toBeTruthy()
    })
  })

  describe('FactsService::generateDeepLink', () => {
    it('happy path', async () => {
      let callback = '0x000x'
      let link = fs.generateDeepLink(callback, [{ fact: 'phone_number' }])
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
      expect(payload.facts).toEqual([{ fact: 'phone_number' }])
    })

    it('happy path with custom options', async () => {
      let callback = '0x000x'
      let link = fs.generateDeepLink(callback, [{ fact: 'phone_number' }], {
        cid: 'cid',
        selfid: 'selfid'
      })
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
      expect(payload.facts).toEqual([{ fact: 'phone_number' }])
      expect(payload.jti.length).toEqual(36)
    })

    it('happy path for development', async () => {
      let callback = '0x000x'
      r.env = 'development'
      let link = fs.generateDeepLink(callback, [{ fact: 'phone_number' }])
      const url = new URL(link)

      let callbackURL = new URL(url.searchParams.get('link'))
      expect(callbackURL.host).toEqual('developer.joinself.com')

      let ciphertext = JSON.parse(
        Buffer.from(callbackURL.searchParams.get('qr'), 'base64').toString()
      )
      let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
      expect(payload.typ).toEqual('identities.facts.query.req')
      expect(payload.iss).toEqual('appID')
      expect(payload.sub).toEqual('-')
      expect(payload.aud).toEqual('-')
      expect(payload.jti.length).toEqual(36)
      expect(payload.facts).toEqual([{ fact: 'phone_number' }])
    })

    it('happy path for production', async () => {
      let callback = '0x000x'
      r.env = ''
      let link = fs.generateDeepLink(callback, [{ fact: 'phone_number' }])
      const url = new URL(link)

      let callbackURL = new URL(url.searchParams.get('link'))
      expect(callbackURL.host).toEqual('developer.joinself.com')

      let ciphertext = JSON.parse(
        Buffer.from(callbackURL.searchParams.get('qr'), 'base64').toString()
      )
      let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
      expect(payload.typ).toEqual('identities.facts.query.req')
      expect(payload.iss).toEqual('appID')
      expect(payload.sub).toEqual('-')
      expect(payload.aud).toEqual('-')
      expect(payload.jti.length).toEqual(36)
      expect(payload.facts).toEqual([{ fact: 'phone_number' }])
    })
  })

  describe('FactsService::generateQR', () => {
    it('happy path', async () => {
      let qr = fs.generateQR([{ fact: 'phone_number' }])
      expect(qr).not.toBe('')
    })
    it('happy path custom selfid', async () => {
      let qr = fs.generateQR([{ fact: 'phone_number' }], { selfid: 'selfid' })
      expect(qr).not.toBe('')
    })
  })

  describe('FactsService::subscribe', () => {
    it('happy path', async () => {
      const msMock = jest
        .spyOn(ms, 'subscribe')
        .mockImplementation((messageType: string, callback: (n: any) => any) => {
          expect(messageType).toEqual('identities.facts.query.resp')
        })

      expect(fs.subscribe((n: any): any => {})).toBeUndefined()
    })
  })

  describe('FactsService::issue', () => {
    let history = require('./__fixtures__/valid_custom_device_entry.json')
    it('happy path', async () => {
      const axios = require('axios')

      jest.mock('axios')
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: ['cjK0uSMXQjKeaKGaibkVGZ']
      })

      axios.get.mockResolvedValueOnce({
        status: 200,
        data: { id: '26742678155', history: history }
      })

      jest.spyOn(is, 'app').mockImplementation(
        (appID: string): Promise<any> => {
          return new Promise(resolve => {
            resolve({ paid_actions: true })
          })
        }
      )

      const msMock = jest.spyOn(ms, 'send').mockImplementation(
        (cid: string, data): Promise<any> => {
          // The cid is automatically generated
          expect(cid.length).toEqual(36)
          // The cid is automatically generated
          let buf = new flatbuffers.ByteBuffer(data.data[0].valueOf() as Uint8Array)
          let msg = message.Message.getRootAsMessage(buf);

          // Envelope
          expect(msg.id().length).toEqual(36)
          expect(msg.recipient()).toEqual('26742678155:cjK0uSMXQjKeaKGaibkVGZ')
          expect(msg.sender()).toEqual('appID:1')
          expect(msg.msgtype()).toEqual(mtype.MsgType.MSG)

          // Check ciphertext
          let input = msg.ciphertextArray()
          let ciphertext = JSON.parse(Buffer.from(input).toString())
          let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
          expect(payload.typ).toEqual('identities.facts.issue')
          expect(payload.iss).toEqual('appID')
          expect(payload.sub).toEqual('26742678155')
          expect(payload.aud).toEqual('26742678155')
          expect(payload.cid).toEqual(cid)
          expect(payload.jti.length).toEqual(36)
          expect(payload.facts).toEqual(undefined)
          expect(payload.attestations.length).toEqual(1)

          let at = JSON.parse(Buffer.from(payload.attestations[0].payload, 'base64').toString())
          expect(at.iss).toEqual('appID')
          expect(at.sub).toEqual('26742678155')
          expect(at.source).toEqual('source')
          expect(at.verified).toEqual(true)
          expect(at.facts.length).toEqual(1)
          expect(at.facts[0].key).toEqual('foo')
          expect(at.facts[0].value).toEqual('bar')
          expect(at.facts[0].group.name).toEqual('group name')
          expect(at.facts[0].group.icon).toEqual('plane')

          return new Promise(resolve => {
            resolve({ status: 'accepted' })
          })
        }
      )

      let selfid = "26742678155"
      let source = "source"
      let fact = new FactToIssue("foo", "bar", source, {
        group: new Group("group name", "plane")
      })

      await fs.issue(selfid, [ fact ])
    })

  })

})
