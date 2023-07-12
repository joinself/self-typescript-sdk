// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from '../src/jwt'
import IdentityService from '../src/identity-service'
import Messaging from '../src/messaging'
import FactsService from '../src/facts-service'

import { WebSocket, Server } from 'mock-socket'
import * as message from '../src/msgproto/message'
import * as mtype from '../src/msgproto/msg-type'
import MessagingService from '../src/messaging-service'
import EncryptionMock from './mocks/encryption-mock'

import * as flatbuffers from 'flatbuffers'

describe('Messaging service', () => {
  let mss: MessagingService
  let jwt: Jwt
  let ms: Messaging
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
    /*
    jest.spyOn(mss, 'fixEncryption').mockImplementation((msg: string): any => {
      return msg
    })
    */
  })

  afterEach(async () => {
    jwt.stop()
    mockServer.close()
  })

  describe('MessagingService::subscribe', () => {
    it('happy path', async () => {
      const msMock = jest
        .spyOn(ms, 'subscribe')
        .mockImplementation((messageType: string, callback: (n: any) => any) => {
          expect(messageType).toEqual('test')
        })

      expect(ms.subscribe('test', (n: any): any => {})).toBeUndefined()
    })
  })

  describe('MessagingService::send', () => {
    it('happy path', async () => {
      const axios = require('axios')
      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: ['deviceID']
      })

      const msMock = jest.spyOn(ms, 'send').mockImplementation(
        (cid: string, data): Promise<any | Response> => {
          // The cid is automatically generated
          expect(cid != undefined).toBeTruthy()
          let buf = new flatbuffers.ByteBuffer(data.data.valueOf()[0] as Uint8Array)
          let msg = message.Message.getRootAsMessage(buf);

          // Envelope
          expect(msg.id().length).toEqual(36)
          expect(msg.msgtype()).toEqual(mtype.MsgType.MSG)

          // Check ciphertext
          let input = msg.ciphertextArray()
          let ciphertext = JSON.parse(Buffer.from(input).toString())
          let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
          expect(payload.jti.length).toEqual(36)
          expect(payload.cid.length).toEqual(36)
          expect(payload.iss).toEqual('appID')
          expect(payload.sub).toEqual('selfid')

          return new Promise(resolve => {
            resolve(true)
          })
        }
      )

      await mss.send('selfid', {})
    })
  })

  describe('MessagingService::notify', () => {
    it('happy path', async () => {
      const axios = require('axios')
      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: ['deviceID']
      })

      const msMock = jest.spyOn(ms, 'send').mockImplementation(
        (cid: string, data): Promise<any | Response> => {
          // The cid is automatically generated
          expect(cid != undefined).toBeTruthy()
          // The cid is automatically generated
          let buf = new flatbuffers.ByteBuffer(data.data.valueOf()[0] as Uint8Array)
          let msg = message.Message.getRootAsMessage(buf);

          // Envelope
          expect(msg.id().length).toEqual(36)
          expect(msg.msgtype()).toEqual(mtype.MsgType.MSG)

          // Check ciphertext
          let input = msg.ciphertextArray()
          let ciphertext = JSON.parse(Buffer.from(input).toString())
          let payload = JSON.parse(Buffer.from(ciphertext['payload'], 'base64').toString())
          expect(payload.jti.length).toEqual(36)
          expect(payload.cid.length).toEqual(36)
          expect(payload.iss).toEqual('appID')
          expect(payload.sub).toEqual('selfid')
          expect(payload.description).toEqual('hello world!')

          return new Promise(resolve => {
            resolve(true)
          })
        }
      )

      await mss.notify('selfid', 'hello world!')
    })
  })
})
