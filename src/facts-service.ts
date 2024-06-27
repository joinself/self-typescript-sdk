// Copyright 2020 Self Group Ltd. All Rights Reserved.

import { v4 as uuidv4 } from 'uuid'

import Fact from './fact'
import FactResponse from './fact-response'

import Requester from './requester';
import { FileObject } from './chat-object';


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
    const options = opts ? opts : {}
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
    const options = opts ? opts : {}
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
    const options = opts ? opts : {}
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
    const options = opts ? opts : {}
    options['auth'] = true

    return this.requester.generateDeepLink(callback, facts, options)
  }

  /**
   * Issues a fact to a specific user.
   * @param selfid self identifier for the recipient
   * @param facts list of facts to be issued
   * @param opts optional parameters like the list of viewers of the fact
   */
  async issue(selfid: string, facts: FactToIssue[], opts?: { viewers?: string[]}) {
    const id = uuidv4()

    // Get user's device
    const devices = await this.requester.is.devices(selfid)

    const c = this.buildIssueRequest(selfid, facts, opts)
    const ciphertext = this.requester.jwt.toSignedJson(c)

    const msgs = []
    for (const device of devices) {
      const msg = await this.requester.buildEnvelope(id, selfid, device, ciphertext)
      msgs.push(msg)
    }

    this.requester.logger.info('sending ' + id)
    this.requester.ms.send(c.cid, { data: msgs, waitForResponse: false })
  }

  private buildIssueRequest(selfid: string, facts: FactToIssue[], opts?: { cid?: string, exp?: number, viewers?: string[]}): {[k: string]: any} {
    const options = opts ? opts : {}
    const cid = options.cid ? options.cid : uuidv4()
    const expTimeout = options.exp ? options.exp : 300000

    // Calculate expirations
    const iat = new Date(Math.floor(this.requester.jwt.now()))
    const exp = new Date(Math.floor(this.requester.jwt.now() + expTimeout * 60))

    const attestations = []
    for (const fact of facts){
      const f = {
        jti: uuidv4(),
        sub: selfid,
        iss: this.requester.jwt.appID,
        iat: iat.toISOString(),
        exp: exp.toISOString(),
        source: fact['source'],
        verified: true,
        facts: [ {
          source: fact.source,
          key: fact.key,
          value: fact.value,
          group: fact.group,
          type: fact.type
        } ] }

      attestations.push(this.requester.jwt.toJWS(f))
    }

    const objects = []
    facts.forEach((fact: FactToIssue) => {
      if (fact.object && fact.object !== null) {
        objects.push(fact.object.toPayload());
      }
    });

    // Ciphertext
    const c: {[k: string]: any} = {
      typ: 'identities.facts.issue',
      iss: this.requester.jwt.appID,
      sub: selfid,
      aud: selfid,
      iat: iat.toISOString(),
      exp: exp.toISOString(),
      cid,
      jti: uuidv4(),
      status: 'verified',
      attestations,
      objects
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
  object?: FileObject

  constructor(key: string, value: string|FileObject, source: string, opts?: {group?: Group, type?: string}) {
    const options = opts ? opts : {}

    if (value instanceof FileObject) {
      this.value = value.hash
      this.object = value
    } else {
      this.value = value
    }

    this.key = key
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
    const options = opts ? opts : {}

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
    const cert = JSON.stringify({
      subjects: this.subjects,
      actions: this.actions,
      effect: this.effect,
      resources: this.resources,
    })

    return Buffer.from(cert).toString('base64')

    // return btoa(cert)
  }

  static parse(input: string) {

    const b = JSON.parse(Buffer.from(input, 'base64').toString())
    return new Delegation(
      b.subjects,
      b.actions,
      b.effect,
      b.resources,
      { conditions: b.conditions, description: b.description }
    )
  }
}

