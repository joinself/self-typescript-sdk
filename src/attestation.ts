// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from './jwt'
import IdentityService from './identity-service'
import { JwtInput } from './jwt'

export default class Attestation {
  origin: string
  to: string
  aud: string
  iss: string
  source: string
  verified: boolean
  sub: string
  expected_value: string
  operator: string
  factName: string
  value: string
  is: IdentityService
  jwt: Jwt

  public static async parse(
    name: string,
    input: JwtInput,
    jwt: Jwt,
    is: IdentityService
  ): Promise<any> {
    let payload = JSON.parse(Buffer.from(input.payload, 'base64').toString())

    let a = new Attestation()

    console.log(payload)

    a.to = payload.sub
    a.origin = payload.iss
    a.aud = payload.aud
    a.source = payload.source
    a.expected_value = payload.expected_value
    a.operator = payload.operator
    a.factName = name
    if (!(name in payload) || payload[name] == undefined) {
      if (payload['facts'] == undefined) {
        return
      } else {
        for (var i = 0; i < payload['facts'].length; i++) {
          if (payload['facts'][i]['key'] == name) {
            a.value = payload['facts'][i]['value']
          }
        }
      }
    } else {
      a.value = payload[name]
    }

    const decode = (str: string): string => Buffer.from(str, 'base64').toString('binary')
    let header = JSON.parse(decode(input['protected']))
    let k = await is.publicKey(payload.iss, header['kid'])
    a.verified = jwt.verify(input, k)

    return a
  }
}
