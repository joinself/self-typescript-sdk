// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from '../src/jwt'
import IdentityService from '../src/identity-service'
import Messaging from '../src/messaging'
import MessagingService from '../src/messaging-service'
import DocsService from '../src/docs-service';

import { WebSocket, Server } from 'mock-socket'
import EncryptionMock from './mocks/encryption-mock'


/**
 * Attestation test
 */
describe('DocsService', () => {
  let ds: DocsService
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

    ds = new DocsService(mss, 'https://api.joinself.com/')
  })

  afterEach(async () => {
    jwt.stop()
    mockServer.close()
  })

  describe('DocsService.requestSignature', async () => {
    it('should send a document.sign.req', async () => {
      let recipient = 'a'
      let body = 'body content'
      const msMock = jest.spyOn(mss, 'send').mockImplementation(
        async (to, payload, opts) => {
          expect(to).toEqual(recipient)
          expect(payload.typ).toEqual('document.sign.req')
          expect(payload.msg).toEqual(body)
          expect(opts).toEqual({ waitForResponse: true })
        }
      )

      await ds.requestSignature(recipient, body, [])
    })
  })

  describe('DocsService::subscribe', () => {
    it('happy path', async () => {
      const msMock = jest.spyOn(mss, 'subscribe').mockImplementation(
        (messageType: string, callback: (n: any) => any) => {
          expect(messageType).toEqual('document.sign.resp')
        })

      expect(ds.subscribe((n: any): any => {})).toBeUndefined()
    })
  })


})
