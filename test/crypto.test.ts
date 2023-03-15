// Copyright 2020 Self Group Ltd. All Rights Reserved.

import Jwt from '../src/jwt'
import IdentityService from '../src/identity-service'
import Crypto from '../src/self-crypto'

var fs = require('fs')
var deleteFolderRecursive = function(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file, index) {
      var curPath = path + '/' + file
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath)
      } else {
        // delete file
        fs.unlinkSync(curPath)
      }
    })
    fs.rmdirSync(path)
  }
}

/**
 * Crypto test
 */
describe('crypto', () => {
  let jwt: Jwt
  let pkB: any
  let skA: string
  let skB: string
  let otkB: string
  let is: IdentityService

  beforeEach(async () => {
    skA = '1:1Re4zgkJDPsIKOE3DRtapBFsynbdZdufzVuM0jXnl+Y'
    skB = '1:GVV4WqN6qQdfD7VQYV/VU7/9CTmWceXtSN4mykhzk7Q'
    pkB = 'UZXk4PSY6LN29R15jUVuDabsoH7VhFkVWGApA0IYLaY'
  })

  afterEach(async () => {
    // jwt.stop()
  })

  it('encrypt / decrypt', async () => {
    let aliceJWT = await Jwt.build('aliceID', skA, { ntp: false })
    let aliceIS = new IdentityService(aliceJWT, 'https://api.joinself.com/')

    let bobJWT = await Jwt.build('bobID', skB, { ntp: false })
    let bobIS = new IdentityService(bobJWT, 'https://api.joinself.com/')

    jest.spyOn(aliceIS, 'postRaw').mockImplementation(
      (url: string, body: any): Promise<number> => {
        return new Promise(resolve => {
          resolve(200)
        })
      }
    )

    jest.spyOn(bobIS, 'postRaw').mockImplementation(
      (url: string, body: any): Promise<number> => {
        return new Promise(resolve => {
          otkB = body[0].key
          resolve(200)
        })
      }
    )

    jest.spyOn(aliceIS, 'devicePublicKey').mockImplementation(
      (selfid: string, did: string): Promise<string> => {
        return new Promise(resolve => {
          resolve(pkB)
        })
      }
    )

    jest.spyOn(aliceIS, 'getRaw').mockImplementation(
      (url: string): Promise<any> => {
        return new Promise(resolve => {
          resolve({ status: 200, data: { id: 'AAAAAQ', key: otkB } })
        })
      }
    )

    const tmp = require('tmp')
    const tmpalice = tmp.dirSync()
    const tmpbob = tmp.dirSync()

    let aliceC = await Crypto.build(aliceIS, '1', tmpalice.name, 'storage_key_alice')
    let bobC = await Crypto.build(bobIS, '1', tmpbob.name, 'storage_key_bob')

    let ciphertext = await aliceC.encrypt('hello bob', [{
      id: 'bobID',
      device: '1',
    }])
    let plaintext = await bobC.decrypt(ciphertext, 'aliceID', '1')
    console.log(plaintext)

    deleteFolderRecursive(tmpalice.name)
    deleteFolderRecursive(tmpbob.name)
  })
})
