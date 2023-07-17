import { ChatMessage } from "./chat-message";
import MessagingService from "./messaging-service";
import { Logger, logging } from './logging';

export default class VoiceService {
  ms: MessagingService
  logger: Logger

  constructor(ms: MessagingService) {
    this.ms = ms
    this.logger = logging.getLogger('core.self-sdk')
  }

  /**
   * Sends a chat.voice.setup message to setup a delegated call.
   * @param recipient
   * @param name
   * @param cid
   */
  async setup(recipient: string, name: string, cid: string) {
    const payload = { typ: "chat.voice.setup" }
    payload['cid'] = cid
    payload['data'] = { name }

    await this.ms.send([recipient], payload)
  }

  /**
   * Subscribes to chat.voice.setup messages.
   * @param callback
   * @param opts
   */
  onSetup(callback: (iss: string, cid: string, data: any) => void, opts: any = {}) {
    this.ms.subscribe("chat.voice.setup", async (res: any): Promise<any> => {
      callback(res['iss'], res['cid'], res['data'])
    })
  }

  /**
   * Sends a chat.voice.start message with the details for starting a call.
   * @param recipient
   * @param cid
   * @param call_id
   * @param peer_info
   * @param data
   */
  async start(recipient: string, cid: string, call_id: string, peer_info: string, data: any) {
    const payload = { typ: "chat.voice.start" }
    payload['cid'] = cid
    payload['call_id'] = call_id
    payload['peer_info'] = peer_info
    payload['data'] = data

    await this.ms.send([recipient], payload)
  }

  /**
   * Subscribes to chat.voice.start messages.
   * @param callback
   * @param opts
   */
  onStart(callback: (iss: string, cid: string, call_id: string, peer_info: string, data: any) => void, opts: any = {}) {
    this.ms.subscribe("chat.voice.start", async (res: any): Promise<any> => {
      callback(res['iss'], res['cid'], res['call_id'], res['peer_info'], res['data'])
    })
  }

  /**
   * Sends a chat.voice.accept message accepting a specific call.
   * @param recipient
   * @param cid
   * @param call_id
   * @param peer_info
   * @param data
   */
  async accept(recipient: string, cid: string, call_id: string, peer_info: string, data: any) {
    const payload = { typ: "chat.voice.accept" }
    payload['cid'] = cid
    payload['cid'] = cid
    payload['call_id'] = call_id
    payload['peer_info'] = peer_info
    payload['data'] = data

    await this.ms.send([recipient], payload)
  }

  /**
   * Subscribes to chat.voice.accept messages.
   * @param callback
   * @param opts
   */
  onAccept(callback: (iss: string, cid: string, call_id: string, peer_info: string, data: any) => void, opts: any = {}) {
    this.ms.subscribe("chat.voice.accept", async (res: any): Promise<any> => {
      callback(res['iss'], res['cid'], res['call_id'], res['peer_info'], res['data'])
    })
  }

  /**
   * Sends a chat.voice.accept message finishing the call.
   * @param recipient
   * @param cid
   * @param call_id
   */
  async stop(recipient: string, cid: string, call_id: string) {
    const payload = { typ: "chat.voice.stop" }
    payload['cid'] = cid
    payload['cid'] = cid
    payload['call_id'] = call_id

    await this.ms.send([recipient], payload)
  }

  /**
   * Subscribes to chat.voice.stop messages.
   * @param callback
   * @param opts
   */
  onStop(callback: (iss: string, cid: string, call_id: string) => void, opts: any = {}) {
    this.ms.subscribe("chat.voice.stop", async (res: any): Promise<any> => {
      callback(res['iss'], res['cid'], res['call_id'])
    })
  }

  /**
   * Sends a chat.voice.busy message finishing the call.
   * @param recipient
   * @param cid
   * @param call_id
   */
  async busy(recipient: string, cid: string, call_id: string) {
    const payload = { typ: "chat.voice.busy" }
    payload['cid'] = cid
    payload['cid'] = cid
    payload['call_id'] = call_id

    await this.ms.send([recipient], payload)
  }

  /**
   * Subscribes to chat.voice.busy messages.
   * @param callback
   * @param opts
   */
  onBusy(callback: (iss: string, cid: string, call_id: string) => void, opts: any = {}) {
    this.ms.subscribe("chat.voice.busy", async (res: any): Promise<any> => {
      callback(res['iss'], res['cid'], res['call_id'])
    })
  }

  /**
   * Sends a chat.voice.summary message Sending details about the call.
   * @param recipient
   * @param cid
   * @param call_id
   */
  async summary(recipient: string, cid: string, call_id: string) {
    const payload = { typ: "chat.voice.summary" }
    payload['cid'] = cid
    payload['cid'] = cid
    payload['call_id'] = call_id

    await this.ms.send([recipient], payload)
  }

  /**
   * Subscribes to chat.voice.summary messages.
   * @param callback
   * @param opts
   */
  onSummary(callback: (iss: string, cid: string, call_id: string) => void, opts: any = {}) {
    this.ms.subscribe("chat.voice.summary", async (res: any): Promise<any> => {
      callback(res['iss'], res['cid'], res['call_id'])
    })
  }

}
