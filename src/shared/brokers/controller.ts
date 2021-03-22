import { resolve4 } from 'dns'

import { events } from 'shared/services/events'
import { FileCache } from 'shared/services/file-cache'
import { log } from 'shared/services/log'

export interface ControllerOptions {
  address?: string
  ip?: string
  port?: number
  name?: string
  preSendHooks?: [(metadata: any) => Promise<any>]
}

export abstract class Controller {
  protected classType: string = 'UNKNOWN'
  protected options: any
  protected connection: any
  protected connected: boolean = false
  protected disconnecting: boolean = false
  protected fileCache: FileCache | null = null

  constructor() {
    this.addEventListeners()
    this.fileCache = new FileCache({
      push: () => this.saveToCache(),
      pull: (data: any) => this.loadFromCache(data),
    })
  }

  public getOptions(): ControllerOptions {
    return this.options
  }

  public abstract getMetadata(): { [key: string]: string }
  public saveToCache() {}
  public loadFromCache(data: any) {}
  protected startDiscovery() {}
  protected endDiscovery() {}
  protected startAcquisition() {}
  protected endAcquisition() {}

  private addEventListeners() {
    events.on('app:end:*', () => {
      if (!this.connected || !this.connection) return
      log.info(
        `Received app termination notification. Should disconnect from ${this.options.name}...`
      )
      this.disconnect()
    })
  }

  public async resolveAddress() {
    return new Promise((resolve: Function, reject: Function) => {
      if (!this.options.address || this.options.address === '') {
        // filecache should exist
        this.fileCache!.setFilename(this.options.name.toUpperCase())
        resolve()
        return
      }
      resolve4(this.options.address, (error: any, addressList: string[]) => {
        if (!addressList || !addressList.length) {
          log.error(
            `Could not resolve domain name for ${this.classType} controller ${this.options.address}.`
          )
          log.error(`Failed with error ${error}.`)
          reject(
            new Error(
              `Could not resolve domain name for ${this.classType} controller.`
            )
          )
          return
        }
        this.options.name =
          this.options.name ||
          (
            this.options.address.replace(/\.([a-z0-9\.-]+)$/gi, '') ||
            this.options.address ||
            this.options.ip
          ).toUpperCase()
        this.options.ip = addressList.pop() || '127.0.0.1'
        log.debug(`Resolved ${this.options.address} to ${this.options.ip}.`)
        // filecache should exist
        this.fileCache!.setFilename(this.options.name.toUpperCase())
        resolve()
      })
    })
  }

  public async connect(): Promise<any> {
    if (this.connection) {
      await this.disconnect()
    }

    if (!/([0-9]{1,3}\.?){4}/.test(this.options.address)) {
      log.verbose(
        `Attempting to resolve IP address for ${this.classType} controller ${this.options.address}...`
      )
      await this.resolveAddress()
    } else {
      if (!this.options.ip) {
        this.options.ip = this.options.address
      }
    }

    this.startDiscovery()
    this.startAcquisition()

    return Promise.resolve()
  }

  public async listen(): Promise<any> {
    this.startDiscovery()
    this.startAcquisition()
    return Promise.resolve()
  }

  public async disconnect(): Promise<any> {
    return Promise.resolve()
  }

  public async destroy(): Promise<any> {
    return Promise.resolve()
  }

  public getName() {
    return this.options.name
  }

  public getConnection() {
    return this.connection
  }
}
