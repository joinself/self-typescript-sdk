// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Fact from './fact'
import Jwt from './jwt'
import IdentityService from './identity-service'
import Attestation from './attestation'
import { FileObject } from './chat-object'
export default class FactResponse {
  payload: any
  is: IdentityService
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
    const r = new FactResponse()

    r.payload = input
    r.is = is
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
      if (fact['fact'] == 'photo') {
        fact['fact'] = 'image_hash'
      }
      r.facts.push(await Fact.parse(fact, jwt, is))
    }

    return r
  }

  fact(name: string): Fact | undefined {
    if (name == "photo") {
      name = "image_hash"
    }
    for (const fact of this.facts) {
      if (fact.fact === name) {
        return fact
      }
    }
    return undefined
  }

  attestation(name: string): (Attestation|null) {
    const att = this.attestationsFor(name)
    if (att.length == 0) {
      return null
    }

    return att[0]
  }

  attestationsFor(name: string): Attestation[] {
    const fact = this.fact(name)
    if (fact === undefined) {
      return []
    }

    return fact.attestations
  }

  attestationValuesFor(name: string): string[] {
    const att = []
    for (const at of this.attestationsFor(name)) {
      att.push(at.value)
    }
    return att
  }

  async object(hash: string): Promise<FileObject> {
    for (const o of this.payload.objects) {
      if (o.image_hash == hash || o.object_hash == hash) {
        const fo = new FileObject(this.is.jwt.authToken(), this.is.url)
        return fo.buildFromObject(o)
      }
    }
    return null
  }
}
