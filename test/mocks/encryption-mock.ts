// Copyright 2020 Self Group Ltd. All Rights Reserved.

import IdentityService from '../../src/identity-service'
import { Recipient } from '../../src/self-crypto';
import { logging, Logger } from '../../src/logging'

export default class EncryptionMock {
  client: IdentityService
  device: string
  storageKey: string
  storageFolder: string
  path: string
  account: Account
  logger: Logger

  public async encrypt(
    message: string,
    recipients: Recipient[],
  ): Promise<Uint8Array> {
    return Buffer.from(message)
  }

  public async decrypt(message: Uint8Array, sender: string, sender_device: string): Promise<string> {
    return message.toString()
  }

  public accountPath(): string {
    return `/tmp/account.pickle`
  }

  public sessionPath(selfid: string, device: string): string {
    return `/tmp/random-session.pickle`
  }

  async getInboundSessionWithBob(message: Uint8Array, session_file_name: string): Promise<any> {}
  async getOutboundSessionWithBob(recipient, recipientDevice, session_file_name: string): Promise<any> {}
}
