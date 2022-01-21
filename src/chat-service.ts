// Copyright 2020 Self Group Ltd. All Rights Reserved.

import MessagingService from '../dist/types/messaging-service';
import IdentityService from '../dist/types/identity-service';
import { logging, Logger } from './logging'
import { ChatMessage } from './chat-message';


export default class ChatService {
  is: IdentityService
  ms: MessagingService
  logger: Logger

  /**
   * Creates a new ChatService object.
   * @param ms messaging service.
   * @param is identity service.
   */
  constructor(ms: MessagingService, is: IdentityService) {
    this.ms = ms
    this.is = is
    this.logger = logging.getLogger('core.self-sdk')
  }

  /**
   * Sends a message to a list of recipients.
   * @param recipients list of recipients to send the message to.
   * @param body contents of the message to be sent.
   * @param opts options
   * @returns chat message sent
   */
  async message(recipients: string|string[], body: string, opts: any = {}): Promise<ChatMessage> {
    this.logger.debug(`sending message to ${recipients} -> ${body}`)
    recipients = stringToArray(recipients)

    var aud = opts['gid']
    if (aud == undefined) {
      aud = recipients[0]
    }

    let payload: any = {
      typ: "chat.message",
      aud: aud,
      msg: body,
    }

    if ("jti" in opts) payload['jti'] = opts['jti'];
    if ("gid" in opts) payload['gid'] = opts['gid'];
    if ("rid" in opts) payload['rid'] = opts['rid'];

/*
    if(objects.length > 0) {
      payload.objects = []
      for (var i = 0; i< objects.length; i++) {
        let path = objects[i]
        if (!isValidHttpUrl(objects[i])) {
          path = `${this.objectStorageFolder}${objects[i]}`
        }
        let obj = await this.encryptionClient?.fileToObject(path)
        log.warn(obj)
        payload.objects.push(obj)
      }

      payload.mime = "attachment"
    }
*/

    console.log("......")
    console.log(recipients)
    console.log(payload)
    console.log("......")
    await this.ms.send(recipients, payload)
    let cm = new ChatMessage(this, recipients, payload)
    return  cm
  }

  /**
   * Sends a message to confirm a list of messages (identified by it's cids)
   * have been delivered.
   * @param recipients recipients of the message.
   * @param cids conversation ids to be marked as delivered.
   * @param gid group id if any
   */
  async delivered(recipients: string|string[], cids: string|string[], gid:string|null) {
    await this.confirm("delivered", recipients, cids, gid)
  }

  /**
   * Sends a message to confirm a list of messages (identified by it's cids)
   * have been read.
   * @param recipients recipients of the message.
   * @param cids conversation ids to be marked as read.
   * @param gid group id if any
   */
  async read(recipients: string|string[], cids: string|string[], gid:string|null) {
    await this.confirm("read", recipients, cids, gid)
  }

  async edit(recipients: string[], cid: string, body: string, gid:string|null) {
    let p = {
      typ: "chat.message.edit",
      cid: cid,
      msg: body,
    }
    if (gid != undefined && gid != null) p['gid'] = gid;
    await this.ms.send(recipients, p)
  }

  async delete(recipients: string[], cids: string|string[], gid: string|null) {
    let p = {
      typ: "chat.message.delete",
      cids: stringToArray(cids)
    }
    if (gid != undefined && gid != null && gid.length > 0) p['gid'] = gid;
    await this.ms.send(recipients, p)
  }

  invite(gid: string, name: string, members: string[], opts:any = {}) {

  }

  join(gid: string, members: string[]) {

  }

  leave(gid: string, members: string[]) {

  }

  /**
   * Subscribes to an incoming chat message
   * @param callback function to be called when a message is received.
   * @param opts extra options.
   */
  onMessage(callback: (cm: ChatMessage) => void, opts: any = {}) {
    this.ms.subscribe("chat.message", (res: any): any => {
      let cm = new ChatMessage(this, res['aud'], res)

      if (!('mark_as_delivered' in opts && opts['mark_as_delivered'] == false)) cm.markAsDelivered();
      if ('mark_as_read' in opts && opts['mark_as_read'] == true) cm.markAsRead();

      callback(cm)
    })
  }

  onInvite(callback: any) {
  }

  onJoin(callback: any) {
  }

  onLeave(callback: any) {
  }

  private async confirm(action: string, recipients: string|string[], cids: string|string[], gid: string|null) {
    recipients = stringToArray(recipients)
    cids = stringToArray(cids)
    let p = {
      typ: `chat.message.${action}`,
      cids: cids,
    }
    if (gid != undefined && gid != null && gid.length > 0) p['gid'] = gid;
    await this.ms.send(recipients, p)
  }
}

export function stringToArray(recipients: string|string[]): string[] {
  if (typeof recipients === 'string' || recipients instanceof String) {
    return [ <string>recipients ]
  }
  return recipients
}

