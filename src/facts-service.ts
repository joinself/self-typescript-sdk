// Copyright 2020 Self Group Ltd. All Rights Reserved.

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
   * @param callback the url you want your users to be sent back after authentication.
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
}
