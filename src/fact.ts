// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Attestation from './attestation'
import Jwt from './jwt'
import IdentityService from './identity-service'
import { logging, Logger } from './logging'

const FACT_EMAIL = 'email_address'
const FACT_PHONE = 'phone_number'
const FACT_DISPLAY_NAME = 'display_name'
const FACT_DOCUMENT_NUMBER = 'document_number'
const FACT_GIVEN_NAMES = 'given_names'
const FACT_SURNAME = 'surname'
const FACT_SEX = 'sex'
const FACT_ISSUING_AUTHORITY = 'issuing_authority'
const FACT_NATIONALITY = 'nationality'
const FACT_ADDRESS = 'address'
const FACT_PLACE_OF_BIRTH = 'place_of_birth'
const FACT_DATE_OF_BIRTH = 'date_of_birth'
const FACT_DATE_OF_ISSUANCE = 'date_of_issuance'
const FACT_DATE_OF_EXPIRATION = 'date_of_expiration'
const FACT_VALID_FROM = 'valid_from'
const FACT_VALID_TO = 'valid_to'
const FACT_CATEGORIES = 'categories'
const FACT_SORT_CODE = 'sort_code'
const FACT_COUNTRY_OF_ISSUANCE = 'country_of_issuance'
const FACT_ACCOUNT_ID = 'account_id'
const FACT_NICKNAME = 'nickname'

const SOURCE_USER_SPECIFIED = 'user_specified'
const SOURCE_PASSPORT = 'passport'
const SOURCE_DRIVING_LICENSE = 'driving_license'
const SOURCE_IDENTITY_CARD = 'identity_card'
const SOURCE_TWITTER = 'twitter'
const SOURCE_LINKEDIN = 'linkedin'
const SOURCE_FACEBOOK = 'facebok'

let validSources = [
  SOURCE_USER_SPECIFIED,
  SOURCE_PASSPORT,
  SOURCE_DRIVING_LICENSE,
  SOURCE_IDENTITY_CARD,
  SOURCE_TWITTER,
  SOURCE_LINKEDIN,
  SOURCE_FACEBOOK
]
let factsForPassport = [
  FACT_DOCUMENT_NUMBER,
  FACT_SURNAME,
  FACT_GIVEN_NAMES,
  FACT_DATE_OF_BIRTH,
  FACT_DATE_OF_EXPIRATION,
  FACT_SEX,
  FACT_NATIONALITY,
  FACT_COUNTRY_OF_ISSUANCE
]

let factsForDL = [
  FACT_DOCUMENT_NUMBER,
  FACT_SURNAME,
  FACT_GIVEN_NAMES,
  FACT_DATE_OF_BIRTH,
  FACT_DATE_OF_ISSUANCE,
  FACT_DATE_OF_EXPIRATION,
  FACT_ADDRESS,
  FACT_ISSUING_AUTHORITY,
  FACT_PLACE_OF_BIRTH,
  FACT_COUNTRY_OF_ISSUANCE
]

let factsForTwitter = [FACT_ACCOUNT_ID, FACT_NICKNAME]
let factsForLinkedin = [FACT_ACCOUNT_ID, FACT_NICKNAME]
let factsForFacebook = [FACT_ACCOUNT_ID, FACT_NICKNAME]

let factsForUser = [FACT_DOCUMENT_NUMBER, FACT_DISPLAY_NAME, FACT_EMAIL, FACT_PHONE]
const logger = logging.getLogger('core.self-sdk')

export default class Fact {
  fact: string
  operator?: string
  expected_value?: string
  sources?: string[]
  attestations?: Attestation[]

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

    let valid = true
    if (input.sources == undefined) {
      if ([...factsForPassport, ...factsForDL, ...factsForUser, ...factsForTwitter, ...factsForLinkedin, ...factsForFacebook].includes(input.fact) == false) {
        valid = false
      }
    } else {
      for (var i = 0; i < input.sources.length; i++) {
        let s = input.sources[i]
        if (!validSources.includes(s)) {
          throw new TypeError(errInvalidSource)
        }
        if (s == SOURCE_PASSPORT || s == SOURCE_IDENTITY_CARD) {
          if (!factsForPassport.includes(input.fact)) {
            logger.warn(errInvalidFactToSource)
            valid = false
            return
          }
        }
        if (s == SOURCE_DRIVING_LICENSE) {
          if (!factsForDL.includes(input.fact)) {
            logger.warn(errInvalidFactToSource)
            valid = false
            return
          }
        }
        if (s == SOURCE_USER_SPECIFIED) {
          if (!factsForUser.includes(input.fact)) {
            logger.warn(errInvalidFactToSource)
            valid = false
            return
          }
        }
        if (s == SOURCE_TWITTER) {
          if (!factsForTwitter.includes(input.fact)) {
            logger.warn(errInvalidFactToSource)
            valid = false
            return
          }
        }
        if (s == SOURCE_LINKEDIN) {
          if (!factsForLinkedin.includes(input.fact)) {
            logger.warn(errInvalidFactToSource)
            valid = false
            return
          }
        }
        if (s == SOURCE_FACEBOOK) {
          if (!factsForFacebook.includes(input.fact)) {
            logger.warn(errInvalidFactToSource)
            valid = false
            return
          }
        }

      }
    }

    return valid
  }
}
