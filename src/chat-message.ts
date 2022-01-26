// Copyright 2020 Self Group Ltd. All Rights Reserved.

import ChatService from './chat-service';
import { stringToArray } from './chat-service';
import { FileObject } from './chat-object';

/**
 * Represents a message sent to a conversation on the chat.
 */
export class ChatMessage {
  chat: ChatService
  body: string
  recipients: string[]
  jti: string
  gid: string|undefined
  iss: string
  payload: any
  objects: FileObject[]

  /**
   * Creates a new ChatMessage from a given payload
   * @param c ChatService.
   * @param recipients list of the recipients this message is shared with.
   * @param payload message payload.
   */
  constructor(c: ChatService, recipients: string|string[], payload: any) {
    this.chat = c
    this.iss = payload['iss']
    this.body = payload['msg']
    this.recipients = stringToArray(recipients)
    this.jti = payload['jti']
    this.gid = payload['gid']
    this.payload = payload
  }

  /**
   * Processes message objects if any.
   */
  async processObjects() {
    if ('objects' in this.payload) {
      this.objects = []
      for (var i = 0; i<this.payload.objects.length; i++) {
        let fo = new FileObject(this.chat.is.jwt.authToken(), this.chat.is.url)
        await fo.buildFromObject(this.payload.objects[i])
        this.objects.push(fo)
      }
    }
  }

  /**
   * Deletes the current message from the conversation.
   */
  async delete() {
    await this.chat.delete(this.recipients, this.jti, this.gid)
  }

  /**
   * Modifies the body of the text message.
   * @param body new text message to be set.
   * @returns
   */
  async edit(body: string) {
    if (this.amITheRecipient()) return;

    this.body = body
    await this.chat.edit(this.recipients, this.jti, this.body, this.gid)
  }

  /**
   * Marks a message as delivered.
   * @returns
   */
  async markAsDelivered() {
    if (!this.amITheRecipient()) return;

    await this.chat.delivered(this.iss, this.jti, this.gid)
  }

  /**
   * Marks a message as read.
   * @returns
   */
  async markAsRead() {
    if (!this.amITheRecipient()) return;

    await this.chat.read(this.iss, this.jti, this.gid)
  }

  /**
   * Sends a direct response (mention) to a message.
   * @param body
   * @returns
   */
  async respond(body: string): Promise<ChatMessage> {
    return await this.message(body, { rid: this.jti })
  }

  /**
   * Sends a message to this current conversation.
   * @param body Body of the message.
   * @param opts message modifiers.
   * @returns
   */
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
