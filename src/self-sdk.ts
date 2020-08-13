// Import here Polyfills if needed. Recommended core-js (npm i -D core-js)
// import "core-js/fn/array.find"
import AuthenticationService from './authentication-service'
import FactsService from './facts-service'
import IdentityService from './identity-service'
import MessagingService from './messaging-service'
import Jwt from './jwt'
import Messaging from './messaging'

/**
 * SelfSDK allow you interact with self network.
 */
export default class SelfSDK {
  appID: string
  appKey: string
  storageKey: string
  baseURL: string
  messagingURL: string
  autoReconnect: boolean
  jwt: any
  ms: any

  private authenticationService: any
  private factsService: any
  private identityService: any
  private messagingService: any

  defaultBaseURL = 'https://api.selfid.net'
  defaultMessagingURL = 'wss://messaging.selfid.net/v1/messaging'

  /**
   * Use static build method to create your SDK
   * @param appID your SELF_APP_ID
   * @param appKey your SELF_APP_SECRET
   * @param storageKey your SELF_STORAGE_KEY
   * @param opts array of options
   */
  constructor(
    appID: string,
    appKey: string,
    storageKey: string,
    opts?: { baseURL?: string; messagingURL?: string; env?: string; autoReconnect?: boolean }
  ) {
    this.appID = appID
    this.appKey = appKey
    this.storageKey = storageKey

    this.baseURL = this.calculateBaseURL(opts)
    this.messagingURL = this.calculateMessagingURL(opts)
    // this.autoReconnect = opts?.autoReconnect ? opts?.autoReconnect : true;
  }

  /**
   * Creates and starts your SelfSDK instance
   * @param appID your SELF_APP_ID
   * @param appKey your SELF_APP_SECRET
   * @param storageKey your SELF_STORAGE_KEY
   * @param opts optional parameters
   *  - baseURL : string with the baseURL you want to use
   *  - messagingURL : string the messaging url to be used
   *  - env : the environment you want to run your app against
   *  - autoReconnect : will automatically reconnect your app if disconnected
   *  - ntp : enable/disable ntp sync (just for testing)
   * @returns a ready to use SelfSDK
   */
  public static async build(
    appID: string,
    appKey: string,
    storageKey: string,
    opts?: {
      baseURL?: string
      messagingURL?: string
      env?: string
      autoReconnect?: boolean
      ntp?: boolean
    }
  ): Promise<SelfSDK> {
    const sdk = new SelfSDK(appID, appKey, storageKey, opts)
    sdk.jwt = await Jwt.build(appID, appKey, opts)

    sdk.identityService = new IdentityService(sdk.jwt, sdk.baseURL)
    if (sdk.messagingURL === '') {
      sdk.ms = new Messaging(sdk.messagingURL, sdk.jwt, sdk.identityService)
    } else {
      sdk.ms = await Messaging.build(sdk.messagingURL, sdk.jwt, sdk.identityService)
    }

    sdk.messagingService = new MessagingService(sdk.jwt, sdk.ms, sdk.identityService)

    let options = opts ? opts : {}
    let env = options.env ? options.env : '-'
    sdk.factsService = new FactsService(sdk.jwt, sdk.messagingService.ms, sdk.identityService, env)
    sdk.authenticationService = new AuthenticationService(
      sdk.jwt,
      sdk.messagingService.ms,
      sdk.identityService,
      env
    )

    return sdk
  }

  /**
   * Gracefully stops the sdk
   */
  stop() {
    this.jwt.stop()
    this.messagingService.close()
  }

  /**
   * Access the authentication service
   * @returns AuthenticationService
   */
  authentication(): AuthenticationService {
    return this.authenticationService
  }

  /**
   * Access the facts service
   * @returns FactsService
   */
  facts(): FactsService {
    return this.factsService
  }

  /**
   * Access the identity service
   * @returns IdentityService
   */
  identity(): IdentityService {
    return this.identityService
  }

  /**
   * Access the messaging service
   * @returns MessagingService
   */
  messaging(): MessagingService {
    return this.messagingService
  }

  private calculateBaseURL(opts?: { baseURL?: string; env?: string }) {
    if (!opts) {
      return this.defaultBaseURL
    }

    if (opts.baseURL) {
      return opts.baseURL
    }
    if (opts.env) {
      return `https://api.${opts.env}.selfid.net`
    }

    return this.defaultBaseURL
  }

  private calculateMessagingURL(opts?: { messagingURL?: string; env?: string }) {
    if (!opts) {
      return this.defaultMessagingURL
    }

    if (opts.messagingURL !== undefined) {
      return opts.messagingURL
    }
    if (opts.env) {
      return `wss://messaging.${opts.env}.selfid.net/v1/messaging`
    }

    return this.defaultMessagingURL
  }
}
