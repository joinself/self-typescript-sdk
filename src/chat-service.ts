// Copyright 2020 Self Group Ltd. All Rights Reserved.

import MessagingService from './messaging-service';
import IdentityService from './identity-service';
import { logging, Logger } from './logging'
import { ChatMessage } from './chat-message';
import { FileObject } from './chat-object';
import { ChatGroup } from './chat-group';
import { ErrorCorrectLevel, QRCode } from 'qrcode-generator-ts';
import { v4 as uuidv4 } from 'uuid';
import { Hash } from 'crypto';


export default class ChatService {
  is: IdentityService
  ms: MessagingService
  logger: Logger
  env: string

  /**
   * Creates a new ChatService object.
   * @param ms messaging service.
   * @param is identity service.
   */
  constructor(ms: MessagingService, is: IdentityService, opts?: { env?: string}) {
    this.ms = ms
    this.is = is
    this.logger = logging.getLogger('core.self-sdk')

    let options = opts ? opts : {}
    this.env = options.env ? options.env : ""
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

    if ('objects' in opts) {
      payload['objects'] = []
      for (var i = 0; i < opts.objects.length; i++) {
        let fo = new FileObject(this.is.jwt.authToken(), this.is.url)
        await fo.buildFromData(opts.objects[i].name, opts.objects[i].data, opts.objects[i].mime)
        payload['objects'].push(fo.toPayload())
      }
    }

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
  async delivered(recipients: string|string[], cids: string|string[], gid:string|null = null) {
    await this.confirm("delivered", recipients, cids, gid)
  }

  /**
   * Sends a message to confirm a list of messages (identified by it's cids)
   * have been read.
   * @param recipients recipients of the message.
   * @param cids conversation ids to be marked as read.
   * @param gid group id if any
   */
  async read(recipients: string|string[], cids: string|string[], gid:string|null = null) {
    await this.confirm("read", recipients, cids, gid)
  }

  /**
   * Changes the body of a previous message.
   * @param recipients recipients of the message.
   * @param cid referenced message jti.
   * @param body new body.
   * @param gid group id if any.
   */
  async edit(recipients: string[], cid: string, body: string, gid:string|null = null) {
    let p = {
      typ: "chat.message.edit",
      cid: cid,
      msg: body,
    }
    if (gid != undefined && gid != null) p['gid'] = gid;
    await this.ms.send(recipients, p)
  }

  /**
   * Deletes previous messages.
   * @param recipients recipients of the message.
   * @param cids referenced message/s jti.
   * @param gid group id if any.
   */
   async delete(recipients: string[], cids: string|string[], gid: string|null = null) {
    let p = {
      typ: "chat.message.delete",
      cids: stringToArray(cids)
    }
    if (gid != undefined && gid != null && gid.length > 0) p['gid'] = gid;
    await this.ms.send(recipients, p)
  }

  /**
   * Sends a group invitation to a list of members.
   * @param gid  group id.
   * @param name name of the group.
   * @param members list of group members
   * @param opts list of options like link, key...
   */
  async invite(gid: string, name: string, members: string[], opts:any = {}) {
    let p = {
      typ: 'chat.invite',
      gid: gid,
      name: name,
      members: members,
      aud: gid,
    }

    if ('data' in opts) { // it has a group image.
      let fo = new FileObject(this.is.jwt.authToken(), this.is.url)
      await fo.buildFromData("", opts.data, opts.mime)
      let fp = fo.toPayload()
      opts = { ...opts, ...fp }
    }
    this.ms.send(members, p)
    return new ChatGroup(this, p)
  }

  /**
   * Joins a group
   * @param gid group id.
   * @param members list of group members.
   */
   async join(gid: string, members: string[]) {
     // Allow incoming connections from the given members.
    for(var i =0; i < members.length; i++) {
      await this.ms.permitConnection(members[i])
    }

    // Create missing sessions with group members.
    await this.createMissingSessions(members)

    // Send joining confirmation.
    this.ms.send(members, { typ: 'chat.join', gid: gid, aud: gid })
  }

  /**
   * Leaves a group
   * @param gid group id.
   * @param members list of group members.
   */
  async leave(gid: string, members: string[]) {
    this.ms.send(members, { typ: 'chat.remove', gid: gid })
  }

  /**
   * Subscribes to an incoming chat message
   * @param callback function to be called when a message is received.
   * @param opts extra options.
   */
  onMessage(callback: (cm: ChatMessage) => void, opts: any = {}) {
    this.ms.subscribe("chat.message", async (res: any): Promise<any> => {
      let cm = new ChatMessage(this, res['aud'], res)
      await cm.processObjects()

      if (!('mark_as_delivered' in opts && opts['mark_as_delivered'] == false)) cm.markAsDelivered();
      if ('mark_as_read' in opts && opts['mark_as_read'] == true) cm.markAsRead();

      callback(cm)
    })
  }

  /**
   * Subscribes to group invitations.
   * @param callback function to be executed when a message is received.
   */
  onInvite(callback: (cm: ChatGroup) => {}) {
    this.ms.subscribe('chat.invite', async (payload: any): Promise<any> =>{
      let g = new ChatGroup(this, payload)
      callback(g)
    })
  }

  /**
   * Subscribes to group joins.
   * @param callback function to be executed when a message is received.
   */
   onJoin(callback: (iss: string, gid: string) => {}) {
    this.ms.subscribe('chat.join', async (payload: any): Promise<any> =>{
      callback(payload.iss, payload.gid)
    })
  }

  /**
   * Subscribes to people leaving the group messages.
   * @param callback function to be executed when a message is received.
   */
   onLeave(callback: (iss: string, gid: string) => {}) {
    this.ms.subscribe('chat.remove', async (payload: any): Promise<any> =>{
      callback(payload.iss, payload.gid)
    })
  }

  /**
   * Generates a connection request in form of QR
   * @param opts allows you specify optional parameters the expiration time.
   */
  generateConnectionQR(opts?: { exp?: number }): Buffer {
    let body = this.buildConnectionRequest(opts)

    let qr = new QRCode()
    qr.setTypeNumber(20)
    qr.setErrorCorrectLevel(ErrorCorrectLevel.L)
    qr.addData(body)
    qr.make()

    let data = qr.toDataURL(5).split(',')
    let buf = Buffer.from(data[1], 'base64')

    return buf
  }

  /**
   * Generates a connection request in form of deep link
   * @param callback the url you want your users to be sent back after connection.
   * @param opts allows you specify optional parameters the expiration time.
   */
  generateConnectionDeepLink(callback: string, opts?: { exp?: number }): string {
    let body = this.buildConnectionRequest(opts)
    let encodedBody = this.is.jwt.encode(body)

    if (this.env === '') {
      return `https://links.joinself.com/?link=${callback}%3Fqr=${encodedBody}&apn=com.joinself.app`
    } else if (this.env === 'development') {
      return `https://links.joinself.com/?link=${callback}%3Fqr=${encodedBody}&apn=com.joinself.app.dev`
    }
    return `https://${this.env}.links.joinself.com/?link=${callback}%3Fqr=${encodedBody}&apn=com.joinself.app.${this.env}`
  }

  private buildConnectionRequest(opts?: { exp?: number }): string {
    let options = opts ? opts : {}
    let expTimeout = options.exp ? options.exp : 300000

    // Calculate expirations
    let iat = new Date(Math.floor(this.is.jwt.now()))
    let exp = new Date(Math.floor(this.is.jwt.now() + expTimeout * 60))

    let req = {
        typ: "identities.connections.req",
        iss: this.is.jwt.appID,
        aud: "-",
        sub: "-",
        iat: iat.toISOString(),
        exp: exp.toISOString(),
        jti: uuidv4(),
        require_confirmation: true,
    }
    let body = this.is.jwt.toSignedJson(req)

    return body
  }

  /**
   * Subscribes to group invitations.
   * @param callback function to be executed when a connection message is received.
   */
   onConnection(callback: (cm: ChatGroup) => {}) {
    this.ms.subscribe('identities.connections.resp', async (payload: any): Promise<any> =>{
      callback(payload)
    })
  }
  // Group invites may come with members of the group we haven't set up a session
  // previously, for those identitiese need to establish a session, but only if
  // our identity appears before the others in the list members.
  private async createMissingSessions(members: string[]) {
    if (members === undefined) return;

    let posteriorMembers = false
    var requests = [];

    for (var i=0; i<members.length; i++) {
      if (posteriorMembers) {
        let devices = await this.is.devices(members[i])
        for (var j=0; j<devices.length; j++) {
          if (!this.ms.ms.hasSession(members[i], devices[j])) {
            var recipient = members[i] + ":" + devices[j]
            this.logger.debug(`sending sessions.create to ${recipient}`)
            requests.push(this.ms.send(recipient, {
              typ: `sessions.create`,
              aud: members[i],
            }))
          }
        }
      }

      if (members[i] == this.is.jwt.appID) {
        posteriorMembers = true
      }
    }
    return Promise.all(requests);
  }


  /**
   * Sends a confirmation message read|delivered to the specified recipients.
   * @param action delivered|read
   * @param recipients recipient/s of the confirmation/s
   * @param cids confirmation ids.
   * @param gid group id if any.
   */
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

