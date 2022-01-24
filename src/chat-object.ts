import { logging, Logger } from './logging'

const axios = require('axios').default;

export class FileObject {
  token: string
  url: string
  link: string
  name: string
  mime: string
  expires: BigInteger
  content: Buffer
  key: string
  nonce: string
  ciphertext: string
  _sodium: any
  logger: Logger

  constructor(token, url) {
    this.token = token
    this.url = url
    this._sodium = require('libsodium-wrappers-sumo');
    this.logger = logging.getLogger('core.self-sdk')
  }

  async buildFromData(name: string, data: string, mime: string): Promise<FileObject> {
    await this._sodium.ready;

    // Encrypt the message
    let obj = this.encryptObject(data)

    // Push the encrypted message
    let remoteObject = await this.postObject(obj.ciphertext)

    this.link = `${this.url}/v1/objects/${remoteObject.id}`,
    this.key = obj.key
    this.expires = remoteObject.expires
    this.mime = mime
    this.name = name

    return this
  }

  async buildFromObject(input: any): Promise<FileObject> {
    await this._sodium.ready;

    let response = await this.getRemoteFileContents(input['link'], input['expires'])
    let buf = response.contents

    if ('key' in input) {
      let keyDetails = this.extractShareableKey(input['key'])
      let dt = this._sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        buf,
        null,
        keyDetails.nonce,
        keyDetails.key,
      )
      buf = Buffer.from(dt)
    }

    this.content = buf
    this.link = input['link']
    this.name = input['name']
    this.mime = input['mime']
    this.expires = input['expires']

    return this
  }

  toPayload() {
    return {
      name: this.name,
      link: this.link,
      key: this.key,
      mime: this.mime,
      expires: this.expires
    }
  }

  private encryptObject(ciphertext: string) {
    let key = this._sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
    let pNonce = this._sodium.randombytes_buf(this._sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    let ct = this._sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      ciphertext,
      null,
      null,
      pNonce,
      key
    );

    return { key: this.buildShareableKey(key, pNonce), ciphertext: ct }
  }

  /**
   * Extracts key and nonce from a shareable key
   * @param key shareable key
   * @returns
   */
  private extractShareableKey(key: any): any {
    let s = this._sodium.from_base64(key, this._sodium.base64_variants.URLSAFE_NO_PADDING)
    return { key: s.slice(0, 32), nonce: s.slice(32) }
  }

  /**
   * Builds a shareable key from a key and a nonce
   * @param key Chacha20 public key
   * @param nonce Chacha20 public nonce
   * @returns
   */
   private buildShareableKey(key: any, nonce: any): any {
    var composedKey = new Uint8Array(key.byteLength + nonce.byteLength);
    composedKey.set(key, 0);
    composedKey.set(nonce, key.byteLength);


    return this._sodium.to_base64(composedKey, this._sodium.base64_variants.URLSAFE_NO_PADDING)
   }

  // fileUrl: the absolute url of the image or video you want to download
  // downloadFolder: the path of the downloaded file on your machine
  private async getRemoteFileContents(link: any, expires: number|undefined): Promise<any> {
    // return { processing: true, contents: null }
    this.logger.debug(`getting remote file contents ${link}`)
    let status = 0
    let content = null

    if (!this.isExpired(expires)) {
      try {
        const response = await axios({
          method: 'GET',
          url: link,
          responseType: 'arraybuffer',
          headers: {
            Authorization: `Bearer ${this.token}`
          }
        });

        if (response.status == 200) {
          // load the retrieved contents
          content = Buffer.from(response.data, 'binary')
        }
        status = response.status
      } catch (error) {
        this.logger.debug(`  error processing remote object reading loading.gif`)
        this.logger.info(error)
      }
    } else {
      this.logger.debug("object is expired")
    }

    return { processing: (status != 200), contents: content }
  }

  /**
   * Posts an object to self /v1/objects
   * @param obj array with details
   * @returns
   */
   private async postObject(data:any):Promise<any> {
    let url = `${this.url}/v1/objects`

    try {
      const axios = require('axios').default
      let res = await axios({
        method: 'post',
        url: url,
        data: data,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/octet-stream"
        },
      })
      return res.data
    } catch (error) {
      this.logger.warn(error);
    }
  }


  private isExpired(expires:number|undefined): boolean {
    if (expires == undefined) return true
    let now = Math.round(new Date().valueOf()/1000)
    return (expires < now)
  }
}
