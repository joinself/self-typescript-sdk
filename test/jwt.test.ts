// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from '../src/jwt'
import { FilesManager } from 'turbodepot-node';

/**
 * Jwt test
 */

describe('jwt', () => {
  let jwt: Jwt
  let pk: any
  let sk: any

  beforeEach(async () => {
    pk = 'UZXk4PSY6LN29R15jUVuDabsoH7VhFkVWGApA0IYLaY'
    sk = '1:GVV4WqN6qQdfD7VQYV/VU7/9CTmWceXtSN4mykhzk7Q'
    let filesManager = new FilesManager();
    let tmpFolder = await filesManager.createTempDirectory('jwt');
    jwt = await Jwt.build('appID', sk, tmpFolder, { ntp: false })
  })

  afterEach(async () => {
    jwt.stop()
  })

  it('signs and verifies with valid keys', () => {
    let token = jwt.authToken()
    let parts = token.split('.')
    let input = {
      protected: parts[0],
      payload: parts[1],
      signature: parts[2]
    }
    let verified = jwt.verify(input, pk)

    expect(verified).toBeTruthy()
  })

  it('calculates dates based on ntp server', () => {
    let before = new Date().valueOf()
    let middle = new Date().valueOf()
    let now = jwt.now()
    expect(now).toBeGreaterThanOrEqual(before)

    let after = new Date().valueOf()
    expect(now).toBeLessThanOrEqual(after)
  })

  it('prepares a message to be sent', () => {
    let output = jwt.prepare({ random: 'object' })
    expect(output).toEqual(
      'eyJwYXlsb2FkIjoiZXlKeVlXNWtiMjBpT2lKdlltcGxZM1FpZlEiLCJwcm90ZWN0ZWQiOiJleUpoYkdjaU9pSkZaRVJUUVNJc0luUjVjQ0k2SWtwWFZDSXNJbXRwWkNJNklqRWlmUSIsInNpZ25hdHVyZSI6IkNHS3NkenFEMnZIVTBvU3lkaFpGckJaNGUyM0otcGFKRGQ0YmRfQ0hUZ0s1MS00RXh4anhXSUM0TXY2WjNMMnpfQnFDSzllZGl6Z3NEYkNsQTF6X0JBIn0'
    )
  })
})
