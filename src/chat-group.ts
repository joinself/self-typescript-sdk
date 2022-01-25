// Copyright 2020 Self Group Ltd. All Rights Reserved.

import ChatService from './chat-service';
import pks from '../test/__fixtures__/pks';
import { ChatMessage } from './chat-message';

/**
 * ChatGroup represents a group conversation.
 */
export class ChatGroup {
  chat: ChatService
  payload: any
  gid: string
  members: string[]
  name: string
  link: string
  key: string //TODO change this to correct type
  mime: string


  /**
   * Creates a new ChatGroup.
   * @param c ChatService.
   * @param p payload.
   */
  constructor(c: ChatService, p: any) {
    this.chat = c
    this.payload = p
    this.gid = p.gid
    this.members = p.members
    this.name = p.name
    if ('link' in p) this.link = p.link;
    if ('key' in p) this.key = p.key;
    if ('mime' in p) this.mime = p.mime;
  }

  /**
   * Invites a user to join this group.
   * @param user self identifier of the user to be invited.
   */
  async invite(user: string) {
    if (user.length == 0) throw new Error("invalid user length");

    this.members.push(user)
    await this.chat.invite(this.gid, this.name, this.members)
  }

  /**
   * Leaves current group.
   */
  async leave() {
    await this.chat.leave(this.gid, this.members)
  }

  /**
   * Joins the current group.
   */
  async join() {
    await this.chat.join(this.gid, this.members)
  }

  /**
   * Sends a message to the current group.
   * @param body text message to be sent.
   * @param opts options to be redirected to the ChatService::Message.
   * @returns the sent ChatMessage.
   */
  async message(body: string, opts: any = {}): Promise<ChatMessage> {
    opts.gid = this.gid
    return await this.chat.message(this.members, body, opts)
  }

}
