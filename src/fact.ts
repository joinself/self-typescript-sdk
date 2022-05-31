// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Attestation from './attestation'
import Jwt from './jwt'
import IdentityService from './identity-service'
import { logging, Logger } from './logging'
import { SOURCE_DEFINITION } from './sources';

const logger = logging.getLogger('core.self-sdk')

export default class Fact {
  fact: string
  operator?: string
  expected_value?: string
  sources?: string[]
  attestations?: Attestation[]
  issuers?: string[]

  public static async parse(input: any, jwt: Jwt, is: IdentityService): Promise<Fact> {
    let f = this.simpleParse(input)
    f.attestations = []
    if ('attestations' in input) {
      for (const a of input.attestations) {
        f.attestations.push(await Attestation.parse(f.fact, a, jwt, is))
      }
    }

    return f
  }

  public static simpleParse(input: any): Fact {
    let f = new Fact()
    f.fact = input.fact
    f.operator = input.operator
    f.expected_value = input.expected_value

    f.sources = []
    if ('sources' in input) {
      f.sources = input.sources
    }

    return f
  }

  public static isValid(input: Fact): boolean {
    let errInvalidFactToSource = 'provided source does not support given fact'
    let errInvalidSource = 'provided fact does not specify a valid source'
    let errInvalidFactName = 'provided fact does not specify a name'

    if (input.fact == '') {
      logger.warn(errInvalidFactName)
      return false
    }

    let spec = SOURCE_DEFINITION["sources"];
    let valid = true

    if (input.issuers && input.issuers.length > 0) {
      return true
    }

    if (input.sources == undefined) { // If source is not provided
      // check if the fact exists
      valid = false
      for (let key in spec) {
        if(spec[key].includes(input.fact)) {
            valid = true
            break
        }
      }
    } else { // If source is provided
      for (var i = 0; i < input.sources.length; i++) {
        let s = input.sources[i]

        // Throw an exception if s is not a valid source
        if(!Object.keys(spec).includes(s)) {
            throw new TypeError(errInvalidSource)
        }

        // return false if the fact does not belong to the source
        if(!spec[s].includes(input.fact)) {
          logger.warn(errInvalidFactToSource)
          valid = false
          return
        }
      }
    }

    return valid
  }
}
