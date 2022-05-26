// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Fact from './fact'
import Jwt from './jwt'
import IdentityService from './identity-service'
import Attestation from './attestation'
export default class FactResponse {
  jti: string
  cid: string
  status: string
  typ: string
  aud: string
  iss: string
  sub: string
  iat: string
  exp: string
  auth: boolean
  facts: Fact[]

  public static async parse(input: any, jwt: Jwt, is: IdentityService): Promise<FactResponse> {
    let r = new FactResponse()

    r.jti = input.jti
    r.cid = input.cid
    r.status = input.status
    r.typ = input.typ
    r.aud = input.aud
    r.iss = input.iss
    r.sub = input.sub
    r.iat = input.iat
    r.exp = input.exp
    r.auth = input.auth || false
    r.facts = []

    for (const fact of input.facts) {
      r.facts.push(await Fact.parse(fact, jwt, is))
    }

    return r
  }

  fact(name: string): Fact | undefined {
    console.log(this.facts)
    for (const fact of this.facts) {
      if (fact.fact === name) {
        return fact
      }
    }
    return undefined
  }

  attestationsFor(name: string): Attestation[] {
    let fact = this.fact(name)
    if (fact === undefined) {
      return []
    }

    return fact.attestations
  }

  attestationValuesFor(name: string): string[] {
    let att = []
    for (const at of this.attestationsFor(name)) {
      att.push(at.value)
    }
    return att
  }
}
