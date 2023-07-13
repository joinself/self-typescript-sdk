import SQLiteStorage from '../src/storage'
import { FilesManager } from 'turbodepot-node';

describe('storage', () => {
  let storageFolder: string
  let storage: SQLiteStorage
  let device: string

  beforeEach(async () => {
    let filesManager = new FilesManager();
    storageFolder = await filesManager.createTempDirectory('chat-service');
    storage = new SQLiteStorage('appID', device, storageFolder)
    await storage.setup()
  })

  afterEach(async () => {
    try {
      const fs = require('fs')
      fs.unlinkSync(`${storageFolder}/identities/devices/${device}/self.db`)
    } catch(e) {
      console.log(e)
    }
  })

  describe('account', () => {
    it('should go throught the whole cicle of creating an account', async () => {
      expect(await storage.accountExists()).toBeFalsy()
      storage.createAccount('olm')
      expect(await storage.accountExists()).toBeTruthy()
      expect(await storage.getAccountOlm()).toEqual('olm')
      expect(await storage.getAccountOffset()).toEqual(0)
      storage.setAccountOffset(10)
      expect(await storage.getAccountOffset()).toEqual(10)
      storage.updateAccount('olmX')
      expect(await storage.getAccountOlm()).toEqual('olmX')
      expect(await storage.getAccountOffset()).toEqual(10)
      storage.setAccountOffset(100)
      expect(await storage.getAccountOlm()).toEqual('olmX')
      expect(await storage.getAccountOffset()).toEqual(100)
    })
  })

  describe('session', () => {
    it('session lifecycle', async () => {
      let sid = 'my:here'
      expect(await storage.sessionExists(sid)).toBeFalsy()
      expect(await storage.getSessionOlm(sid)).toBeNull()
      await storage.createSession(sid, 'olmMe')
      expect(await storage.getSessionOlm(sid)).toEqual('olmMe')
      expect(await storage.sessionExists(sid)).toBeTruthy()
      await storage.updateSession(sid, 'olmX')
      expect(await storage.getSessionOlm(sid)).toEqual('olmX')
    })
  })
})
