import * as KNX from 'knx'

import { log } from 'shared/services/log'

import { KNXAddress, KNXAddressOptions } from './address'
import { Controller, ControllerOptions } from '../controller'

export interface KNXControllerOptions extends ControllerOptions {}

export class KNXController extends Controller {
  protected classType: string = 'KNX'
  protected options: KNXControllerOptions
  protected addresses: { [key: string]: KNXAddress } = {}

  constructor(options: KNXControllerOptions) {
    super()
    this.options = options
  }

  public getMetadata() {
    return {
      protocol: 'KNX',
    }
  }

  public async connect() {
    if (this.connection) {
      await this.disconnect()
    }
    // This will handle DNS resolution etc for us.
    await super.connect()

    log.verbose(
      `Attempting to connect to KNX controller ${this.options.name}...`
    )
    return new Promise((resolve: Function, reject: Function) => {
      this.disconnecting = false
      this.connection = new KNX.Connection(<any>{
        ipAddr: this.options.ip,
        port: this.options.port || 3671,
        useMulticastTunneling: true,
        manualConnect: true,
        handlers: {
          connected: () => {
            this.connected = true
            this.disconnecting = false
            log.info(`Connected to KNX controller ${this.options.name}.`)

            this.connection.on('disconnected', () => {
              if (!this.disconnecting) {
                log.warn(
                  `Unexpected disconnection from KNX controller ${this.options.name}.`
                )
                return
              }
              this.connected = false
              log.verbose(
                `Disconnected from KNX controller ${this.options.name}.`
              )
            })
            // TODO: can this be null?
            return this.fileCache!.readFile().then(() => {
              resolve()
            })
          },
          event: (evt: string, src: string, dest: string, value: Buffer) => {
            log.debug(
              `Received KNX [${this.options.name}]`,
              evt,
              src,
              dest,
              value
            )
            if (evt === 'GroupValue_Write') {
              this.trackAddress(dest, value)
            }
          },
        },
      })
      this.connection.Connect()
    }).catch((e: Error) => {
      log.error(`Error connecting to KNX controller ${this.options.address}.`)
      log.error(`  ${e.message}`)
      log.debug(`  ${e.stack}`)
      this.disconnect()
    })
  }

  public async disconnect() {
    if (!this.connected || !this.connection) {
      return Promise.resolve()
    }

    return new Promise((resolve: Function, reject: Function) => {
      this.disconnecting = true
      log.info(`Disconnecting from KNX controller ${this.options.name}...`)
      this.connection.on('disconnected', () => {
        this.connection = null
        resolve()
      })
      this.connection.Disconnect()
    })
  }

  public getAddress(options: KNXAddressOptions): KNXAddress {
    const persistenceKey = `${options.address}/${options.type}/${options.index}`
    if (!this.addresses[persistenceKey]) {
      this.addresses[persistenceKey] = new KNXAddress({
        ...options,
        connection: this,
      })
    }
    return this.addresses[persistenceKey]
  }

  private trackAddress(knxAddress: string, value?: Buffer) {
    const address = this.getAddress({
      address: knxAddress,
    })
    address.updateStatistics(value as Buffer)
  }

  public saveToCache() {
    return []
  }

  public loadFromCache(data: any) {
    // Do nothing yet...
  }
}
