// Copyright 2020 Self Group Ltd. All Rights Reserved.

import ChatService from './chat-service';
import { stringToArray } from './chat-service';

export class ChatMessage {
  chat: ChatService
  body: string
  recipients: string[]
  jti: string
  gid: string|undefined
  iss: string
  payload: any

  constructor(c: ChatService, recipients: string|string[], payload: any) {
    this.chat = c
    this.iss = payload['iss']
    this.body = payload['msg']
    this.recipients = stringToArray(recipients)
    this.jti = payload['jti']
    this.gid = payload['gid']
    this.payload = payload
  }

  async delete() {
    await this.chat.delete(this.recipients, this.jti, this.gid)
  }

  async edit(body: string) {
    if (this.amITheRecipient()) return;

    this.body = body
    await this.chat.edit(this.recipients, this.jti, this.body, this.gid)
  }

  async markAsDelivered() {
    if (!this.amITheRecipient()) return;

    await this.chat.delivered(this.iss, this.jti, this.gid)
  }

  async markAsRead() {
    if (!this.amITheRecipient()) return;

    await this.chat.read(this.iss, this.jti, this.gid)
  }

  async respond(body: string): Promise<ChatMessage> {
    return await this.message(body, { rid: this.jti })
  }

  async message(body: string, opts: any = {}): Promise<ChatMessage> {
    if (this.gid != undefined && this.gid.length > 0) {
      opts['aud'] = this.gid
      opts['gid'] = this.gid
    }

    let to = this.recipients
    if (this.amITheRecipient()) to = [ this.iss ];

    return await this.chat.message(to, body, opts)
  }

  private amITheRecipient(): boolean {
    return (this.recipients.length == 1 && this.recipients[0] == this.chat.is.jwt.appID)
  }

}
