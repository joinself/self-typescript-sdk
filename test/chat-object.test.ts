// Copyright 2020 Self Group Ltd. All Rights Reserved.

import axios from 'axios';
import { FileObject, RemoteFileInteractor } from '../src/chat-object';

describe("chat-service", () => {
  let token = "aaabbbccc"
  let url = "https://api.joinself.com/test"

  beforeEach(async () => {
  })


  afterEach(async () => {
  })


  describe("ChatObject::constructor", () => {
    it('should construct a basic object', async () => {
      let co = new FileObject(token, url)
      expect(co.token).toEqual(token)
      expect(co.url).toEqual(url)
    })
  })

  describe("ChatObject::buildFromData", () => {
    it("successfully builds an object from data", async () =>{
      let name = "name"
      let data = "super secret data"
      let mime = "text/plain"
      let remoteObject = { id: "111ddd.txt", expires: "expiration" }
      let fi = new RemoteFileInteractor(token, url)
      let encryptedContent = ""

      const fiPostMock = jest.spyOn(fi, 'postObject').mockImplementation(
        async (ciphertext: any): Promise<any> => {
          encryptedContent = ciphertext

          return new Promise(resolve => {
            resolve(remoteObject)
          })
        }
      )

      const fiGetMock = jest.spyOn(fi, 'getRemoteFileContents').mockImplementation(
        async (link: any, expires: number|undefined): Promise<any> => {
          expect(link).toEqual(`${url}/v1/objects/${remoteObject.id}`)

          return new Promise(resolve => {
            resolve({ processing: false, contents: encryptedContent})
          })
        }
      )

      let co = new FileObject(token, url, fi)

      await co.buildFromData(name, Buffer.from(data), mime)

      expect(co.link).toEqual(`${url}/v1/objects/${remoteObject.id}`)
      expect(co.mime).toEqual(mime)
      expect(co.expires).toEqual(remoteObject.expires)
      expect(co.name).toEqual(name)

      let co2 = await co.buildFromObject(co.toPayload())
      expect(co2.link).toEqual(`${url}/v1/objects/${remoteObject.id}`)
      expect(co2.mime).toEqual(mime)
      expect(co2.expires).toEqual(remoteObject.expires)
      expect(co2.name).toEqual(name)
      expect(co2.content.toString()).toEqual(data)
    })
  })
})
