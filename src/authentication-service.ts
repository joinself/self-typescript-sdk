// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Fact from './fact'

import Requester from './requester'
class AuthResponse {
  accepted: boolean
  selfID: string
  errorMessage: string

  constructor(accepted: boolean, selfID?: string, errorMessage?: string) {
    this.accepted = accepted
    this.selfID = selfID
  }

  isAccepted(): boolean {
    return this.accepted
  }
}

/**
 * Input class to handle authentication requests on self network.
 */
export default class AuthenticationService {
  requester: Requester

  /**
   * Constructs the AuthenticationService
   * @param jwt the Jwt
   * @param ms the Messaging object
   * @param is the IdentityService
   * @param env the environment on what you want to run your app.
   */
  constructor(requester: Requester) {
    this.requester = requester
  }

  /**
   * Sends an authentication request to the given Selfid
   * @param selfid the identifier for the identity you want to authenticate
   * @param opts allows you specify optional parameters like the conversation id <cid> or async
   */
  async request(selfID: string, opts?: { cid?: string; async?: boolean }): Promise<AuthResponse> {
    var facts: Fact[] = []
    let options = opts ? opts : {}
    options['auth'] = true

    var res = await this.requester.request(selfID, facts, options)

    return new AuthResponse(res.status === 'accepted', selfID)
  }

  /**
   * Generates a QR code your users can scan from their app to authenticate
   * @param opts allows you specify optional parameters like the conversation id <cid> or the selfid
   */
  generateQR(opts?: { selfid?: string; cid?: string }): Buffer {
    var facts: Fact[] = []
    let options = opts ? opts : {}
    options['auth'] = true

    return this.requester.generateQR(facts, options)
  }

  /**
   * Generates a deep link url so you can authenticate your users with a simple link.
   * @param callback the url you want your users to be sent back after authentication.
   * @param opts optional parameters like selfid or conversation id
   */
  generateDeepLink(callback: string, opts?: { selfid?: string; cid?: string }): string {
    var facts: Fact[] = []
    let options = opts ? opts : {}
    options['auth'] = true

    return this.requester.generateDeepLink(callback, facts, options)
  }

  /**
   * Subscribes to authentication response `identities.authenticate.resp` and calls
   * the given callback.
   * @param callback procedure to be called when a new auth response is received.
   */
  subscribe(callback: (n: any) => any) {
    this.requester.subscribe(true, callback)
  }
}
