// Copyright 2020 Self Group Ltd. All Rights Reserved.

import { v4 as uuidv4 } from 'uuid'
import MessagingService from './messaging-service';
import { logging, Logger } from './logging';
import { FileObject } from './chat-object';


interface Doc {
  name: string,
  data: string,
  mime: string,
}
export default class DocsService {
  ms: MessagingService
  url: string
  logger: Logger

  constructor(ms: MessagingService, url: string) {
    this.ms = ms
    this.url = url
    this.logger = logging.getLogger('core.self-sdk')
  }


  /**
   * Sends a signature request to the specified user.
   *
   * @param recipient the recipient of the request.
   * @param body the message to be displayed to the user.
   * @param objects the list of documents to be signed.
   * @returns Response
   */
  async requestSignature(recipient: string, body: string, objects: Doc[]): Promise<Response | boolean | void> {
    let jti = uuidv4()
    let req = {
      jti: jti,
      cid: jti,
      typ: "document.sign.req",
      aud: recipient,
      msg: body,
      objects: [],
    }

    let auth_token = this.ms.jwt.authToken()

    for (var i=0; i<objects.length; i++) {
      let fo = new FileObject(auth_token, this.url)
      await fo.buildFromData(objects[i].name, objects[i].data, objects[i].mime)
      req['objects'].push(fo.toPayload())
    }

    return await this.ms.send(recipient, req, { waitForResponse: true })
  }

  /**
   * Subscribes to documents sign response `document.sign.resp` and calls
   * the given callback.
   * @param callback procedure to be called when a new document.sign.resp is received.
   */
   subscribe(callback: (n: any) => any) {
    this.ms.subscribe('document.sign.resp', callback)
  }

}
