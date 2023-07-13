// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from '../src/jwt'
import IdentityService from '../src/identity-service'
import pks from './__fixtures__/pks'
import { FilesManager } from 'turbodepot-node';

/**
 * Attestation test
 */
describe('jwt', () => {
  let jwt: Jwt
  let pk: any
  let sk: any
  let is: IdentityService

  beforeEach(async () => {
    pk = 'UZXk4PSY6LN29R15jUVuDabsoH7VhFkVWGApA0IYLaY'
    sk = '1:GVV4WqN6qQdfD7VQYV/VU7/9CTmWceXtSN4mykhzk7Q'
    let filesManager = new FilesManager();
    let tmpFolder = await filesManager.createTempDirectory('identity-service');
    jwt = await Jwt.build('appID', sk, tmpFolder,  { ntp: false })
    is = new IdentityService(jwt, 'https://api.joinself.com/')
  })

  afterEach(async () => {
    jwt.stop()
  })

  describe('IdentityService::devices', () => {
    it('happy path', async () => {
      const axios = require('axios')

      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: ['deviceID']
      })

      let devices = await is.devices('selfid')
      expect(devices.length).toEqual(1)
      expect(devices[0]).toEqual('deviceID')
    })

    it('unauthorized response', async () => {
      const axios = require('axios')

      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 401,
        data: []
      })

      try {
        await is.devices('selfid')
      } catch (e) {
        expect(e.message).toBe("you're not authorized to interact with this identity")
      }
    })

    it('not found identity', async () => {
      const axios = require('axios')

      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 404,
        data: pks
      })

      try {
        await is.devices('selfid')
      } catch (e) {
        expect(e.message).toBe('identity does not exist')
      }
    })

    it('internal error', async () => {
      const axios = require('axios')
      jest.spyOn(axios, 'get').mockRejectedValue(new Error('error'))

      try {
        await is.devices('selfid')
      } catch (e) {
        expect(e.message).toBe('internal error')
      }
    })
  })

  describe('IdentityService::get', () => {
    let history = require('./__fixtures__/valid_custom_device_entry.json')
    it('happy path', async () => {
      const axios = require('axios')

      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: { id: '1112223334', history: history }
      })

      let identity = await is.get('selfid')
      expect(identity.id).toEqual('1112223334')
      expect(identity.history.length).toEqual(1)
    })

    it('unauthorized response', async () => {
      const axios = require('axios')

      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: { id: '1112223334', history: history }
      })

      try {
        await is.get('selfid')
      } catch (e) {
        expect(e.message).toBe("you're not authorized to interact with this identity")
      }
    })

    it('not found identity', async () => {
      const axios = require('axios')

      jest.mock('axios')
      axios.get.mockResolvedValue({
        status: 200,
        data: { id: '1112223334', history: history }
      })

      try {
        await is.get('selfid')
      } catch (e) {
        expect(e.message).toBe('identity does not exist')
      }
    })

    it('internal error', async () => {
      const axios = require('axios')
      jest.spyOn(axios, 'get').mockRejectedValue(new Error('error'))

      try {
        await is.get('selfid')
      } catch (e) {
        expect(e.message).toBe('internal error')
      }
    })
  })

  describe('IdentityService::getRaw', () => {
    it('happy path', async () => {
      const axios = require('axios')

      jest.mock('axios')
      axios.mockResolvedValue({
        status: 200,
        data: { id: '1112223334' }
      })

      let res = await is.getRaw('/random/url')
      expect(res.status).toEqual(200)
      expect(res.data.id).toEqual('1112223334')
    })
  })

  describe('IdentityService::postRaw', () => {
    it('happy path', async () => {
      const axios = require('axios')

      jest.mock('axios')
      axios.mockResolvedValue({
        status: 200,
        data: { id: '1112223334' }
      })

      let status = await is.postRaw('/random/url', {})
      expect(status).toEqual(200)
    })
  })
})
