// Copyright 2020 Self Group Ltd. All Rights Reserved.

import { v4 as uuidv4 } from 'uuid'

import Fact from './fact'
import FactResponse from './fact-response'

import Requester from './requester';


/**
 * A service to manage fact requests
 */
export default class FactsService {
  DEFAULT_INTERMEDIARY = 'self_intermediary'

  requester: Requester

  /**
   * The constructor for FactsService
   * @param requester the Requester
   */
  constructor(requester: Requester) {
    this.requester = requester
  }

  /**
   * Send a fact request to a specific user
   * @param selfID user identifier to send the fact request.
   * @param facts an array with the facts you're requesting.
   * @param opts optional parameters like conversation id or the expiration time
   */
  async request(
    selfID: string,
    facts: Fact[],
    opts?: { cid?: string; exp?: number; async?: boolean, allowedFor?: number, auth?: boolean }
  ): Promise<FactResponse> {
    let options = opts ? opts : {}
    options['auth'] = false

    return this.requester.request(selfID, facts, options)
  }

  /**
   * Sends a request via an intermediary
   * @param selfid user identifier to send the fact request.
   * @param facts an array with the facts you're requesting.
   * @param opts optional parameters like conversation id or the expiration time
   * or the selfid of the intermediary you want to use (defaulting to self_intermediary)
   */
  async requestViaIntermediary(
    selfID: string,
    facts: Fact[],
    opts?: { cid?: string; exp?: number; intermediary?: string, allowedFor?: number }
  ): Promise<FactResponse> {
    let options = opts ? opts : {}
    options['auth'] = false

    return this.requester.requestViaIntermediary(selfID, facts, options)
  }

  /**
   * Subscribes to fact responses `identities.facts.query.resp` and calls
   * the given callback.
   * @param callback procedure to be called when a new facts response is received.
   */
  subscribe(callback: (n: any) => any) {
    this.requester.subscribe(false, callback)
  }

  /**
   * Generates a QR code your users can scan from their app to share facts with your app.
   * @param facts an array with the facts you're requesting.
   * @param opts allows you specify optional parameters like the conversation id <cid>, the selfid or the expiration time.
   */
  generateQR(facts: Fact[], opts?: { selfid?: string; cid?: string; exp?: number }): Buffer {
    let options = opts ? opts : {}
    options['auth'] = true

    return this.requester.generateQR(facts, options)
  }

  /**
   * Generates a deep link url so you can request facts with a simple link.
   * @param callback the redirection identifier you'll be redirected to if the app is not installed.
   * @param facts an array with the facts you're requesting.
   * @param opts optional parameters like selfid or conversation id
   */
  generateDeepLink(
    callback: string,
    facts: Fact[],
    opts?: { selfid?: string; cid?: string }
  ): string {
    let options = opts ? opts : {}
    options['auth'] = true

    return this.requester.generateDeepLink(callback, facts, options)
  }

  /**
   * Issues a fact to a specific user.
   * @param selfid self identifier for the recipient
   * @param facts list of facts to be issued
   * @param opts optional parameters like the list of viewers of the fact
   */
  async issue(selfid: string, facts: FactToIssue[], opts?: { viewers?: String[]}) {
    let id = uuidv4()

    // Get user's device
    let devices = await this.requester.is.devices(selfid)

    let c = this.buildIssueRequest(selfid, facts, opts)
    let ciphertext = this.requester.jwt.toSignedJson(c)

    var msgs = []
    for (var i = 0; i < devices.length; i++) {
      var msg = await this.requester.buildEnvelope(id, selfid, devices[i], ciphertext)
      msgs.push(msg)
    }

    this.requester.logger.info('sending ' + id)
    this.requester.ms.send(c.cid, { data: msgs, waitForResponse: false })
  }

  private buildIssueRequest(selfid: string, facts: FactToIssue[], opts?: { cid?: string, exp?: number, viewers?: String[]}): {[k: string]: any} {
    let options = opts ? opts : {}
    let cid = options.cid ? options.cid : uuidv4()
    let expTimeout = options.exp ? options.exp : 300000

    // Calculate expirations
    let iat = new Date(Math.floor(this.requester.jwt.now()))
    let exp = new Date(Math.floor(this.requester.jwt.now() + expTimeout * 60))

    var attestations = []
    for(var i = 0; i < facts.length; i++) {
      let f = { jti: uuidv4(),
        sub: selfid,
        iss: this.requester.jwt.appID,
        iat: iat.toISOString(),
        exp: exp.toISOString(),
        source: facts[i]['source'],
        verified: true,
        facts: [ facts[i] ] }

      attestations.push(this.requester.jwt.toJWS(f))
    }

    // Ciphertext
    var c: {[k: string]: any} = {
      typ: 'identities.facts.issue',
      iss: this.requester.jwt.appID,
      sub: selfid,
      aud: selfid,
      iat: iat.toISOString(),
      exp: exp.toISOString(),
      cid: cid,
      jti: uuidv4(),
      status: 'verified',
      attestations: attestations
    }

    if(options.viewers) {
      c.viewers = options.viewers
    }

    return c
  }
}

/**
 * Fact to be issued
 */
export class FactToIssue {
  key: string
  value: string
  source: string
  group?: Group
  type?: string

  constructor(key: string, value: string, source: string, opts?: {group?: Group, type?: string}) {
    let options = opts ? opts : {}

    this.key = key
    this.value = value
    this.source = source

    if("group" in options) {
      this.group = options["group"]
    }
    if("type" in options) {
      this.type = options["type"]
    }
  }

}

/**
 * Fact group to be issued
 */
export class Group {
  name: string
  icon?: string

  constructor(name: string, icon: string = "") {
    this.name = name
    this.icon = icon
  }
}

export class Delegation {
  TYPE = "delegation_certificate"
  subjects: string[]
  actions: string[]
  effect: string
  resources: string[]
  conditions: string[]
  description: string

  constructor(subjects: string[], actions: string[], effect: string, resources: string[], opts?: {conditions?: string[], description?: string}) {
    let options = opts ? opts : {}

    this.subjects = subjects
    this.actions = actions
    this.effect = effect
    this.resources = resources
    if("conditions" in options) {
      this.conditions = options["conditions"]
    }
    if("description" in options) {
      this.description = options["description"]
    }
  }

  encode():string {
    let cert = JSON.stringify({
      subjects: this.subjects,
      actions: this.actions,
      effect: this.effect,
      resources: this.resources,
    })

    return Buffer.from(cert).toString('base64')

    // return btoa(cert)
  }

  static parse(input: string) {

    let b = JSON.parse(Buffer.from(input, 'base64').toString())
    return new Delegation(
      b.subjects,
      b.actions,
      b.effect,
      b.resources,
      { conditions: b.conditions, description: b.description }
    )
  }
}

