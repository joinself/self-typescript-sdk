// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from './jwt'
import SignatureGraph from './siggraph'

/**
 * A PublicKey representation
 */
type PublicKey = {
  id: number
  key: string
}

/**
 * An identity object representing both apps and users.
 */
export type Identity = {
  id: string
  history: []
}

/**
 * An app object representing both apps.
 */
export type App = {
  id: string
  history: []
  name: string
  image: string
  paid_actions: boolean
  core: boolean
}

/**
 * A service to manage all requests against Self servers.
 */
export default class IdentityService {
  jwt: Jwt
  url: string

  readonly errUnauthorized = new Error("you're not authorized to interact with this identity")
  readonly errUnexistingIdentity = new Error('identity does not exist')
  readonly errInternal = new Error('internal error')

  /**
   * Creates an instance of IdentityService
   * @param jwt a valid Jwt object
   * @param url the url where the api is located
   */
  constructor(jwt: Jwt, url: string) {
    this.jwt = jwt
    this.url = url
  }

  /**
   * Returns a list of the device identifiers for a specific user.
   * @param selfid the user you want to query the devices.
   */
  async devices(selfid: string): Promise<string[]> {
    console.log('getting devices')
    let devices: string[] = []
    let response: any

    try {
      const axios = require('axios').default

      const options = {
        headers: { Authorization: `Bearer ${this.jwt.authToken()}` }
      }

      response = await axios.get(`${this.url}/v1/identities/${selfid}/devices`, options)
    } catch (error) {
      console.log(error)
      throw this.errInternal
    }

    if (response.status === 200) {
      devices = response.data
    } else if (response.status === 401) {
      throw this.errUnauthorized
    } else if (response.status === 404) {
      throw this.errUnexistingIdentity
    }

    return devices
  }

  /**
   * Returns a public key by id
   * @param selfid identity id
   * @param kid key id
   */
  async publicKey(selfid: string, kid: string): Promise<string> {
    let identity = await this.get(selfid)
    let sg = await SignatureGraph.build(identity['history'])
    let k = sg.keyByID(kid)

    return k.rawPublicKey
  }

  async devicePublicKey(selfid: string, did: string): Promise<string> {
    let identity = await this.get(selfid)
    let sg = await SignatureGraph.build(identity['history'])
    let k = sg.keyByDevice(did)

    return k.rawPublicKey
  }

  /**
   * Gets the details of a specific identity.
   * @param selfid self identifier for the identity.
   */
  async get(selfid: string): Promise<Identity> {
    return <Promise<Identity>>this.getIdentity(selfid, 'identities')
  }

  /**
   * Gets the details of a specific app.
   * @param selfid self identifier for the app.
   */
  async app(selfid: string): Promise<App> {
    return <Promise<App>>this.getIdentity(selfid, 'apps')
  }

  private async getIdentity(selfid: string, typ: string): Promise<Identity | App> {
    console.log('getting identity details')
    let identity: any
    let response: any

    try {
      const axios = require('axios').default

      const options = {
        headers: { Authorization: `Bearer ${this.jwt.authToken()}` }
      }

      response = await axios.get(`${this.url}/v1/${typ}/${selfid}`, options)
    } catch (error) {
      console.log(error)
      throw this.errInternal
    }

    if (response.status === 200) {
      identity = response.data
      identity.history = response.data.history
    } else if (response.status === 401) {
      throw this.errUnauthorized
    } else if (response.status === 404) {
      throw this.errUnexistingIdentity
    }

    return identity
  }

  async postRaw(url: string, body: any): Promise<number> {
    try {
      const axios = require('axios').default

      let res = await axios({
        method: 'post',
        url: url,
        data: body,
        headers: { Authorization: `Bearer ${this.jwt.authToken()}` }
      })
      return res.status
    } catch (error) {
      console.log('postRaw ' + url + ' error: ' + error)
      throw this.errInternal
    }
  }

  async getRaw(url: string): Promise<any> {
    try {
      const axios = require('axios').default

      let res = await axios({
        method: 'get',
        url: url,
        headers: { Authorization: `Bearer ${this.jwt.authToken()}` }
      })
      return res
    } catch (error) {
      console.log('getRaw ' + url + ' error: ' + error)
      throw this.errInternal
    }
  }
}
