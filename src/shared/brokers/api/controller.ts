import fetch from 'isomorphic-fetch'

import { log } from 'shared/services/log'

import { APIInstance } from './instance'
import { Controller, ControllerOptions } from '../controller'

export interface APIControllerOptions extends ControllerOptions {
  protocol: string
  discovery: APIDiscoveryOptions
  updateInterval: number
  acquisition: APIRequestOptions
  getMetadata?: (objectData: any) => { [key: string]: any } | null
}

export interface APIDiscoveryOptions extends APIRequestOptions {
  autoDiscovery: boolean
  autoDiscoveryInterval: number
  filter?: (a: any) => boolean
}

export interface APIRequestOptions {
  method?: string
  path: (uniqueId?: string) => string
  username?: string
  password?: string
  behaviour?: APIAcquisitionBehaviour
  instanceToKey: (a: any) => string
  instanceComparator?: (a: any, b: any, rA?: any, rB?: any) => boolean
  autoDownloadImages?: boolean
  autoDownloadFilename?: (a: any, b: string) => string
  retryInterval?: number
  responseToSet?: (r: any, rPrev?: any) => any
}

export enum APIAcquisitionBehaviour {
  All,
  Grouped,
  Singular,
}

export class APIController extends Controller {
  protected classType: string = 'API'
  protected options: APIControllerOptions

  private instances: { [key: string]: APIInstance } = {}
  private discoveryTimer: any
  private discoveryInProgress: boolean = false
  private acquisitionTimer: any
  private acquisitionInProgress: boolean = false
  private lastDiscoverResponse: any = null
  private lastAcquisitionResponse: any = null

  constructor(options: APIControllerOptions) {
    super()
    this.options = options
  }

  public getMetadata() {
    return {
      protocol: this.options.protocol,
    }
  }

  public getOptions(): APIControllerOptions {
    return this.options
  }

  protected startDiscovery() {
    log.info(`Starting automatic discovery for ${this.options.name}...`)
    this.discoveryTimer = setInterval(
      () => this.discoverObjects(),
      this.options.discovery.retryInterval || 5000
    )
  }

  protected endDiscovery() {
    if (!this.discoveryTimer) return
    log.info(`Completed automatic discovery for ${this.options.name}.`)
    clearInterval(this.discoveryTimer)
    this.discoveryTimer = null

    // Reschedule the next discovery to align with the interval specified
    const nextDiscovery = Math.ceil(
      Math.ceil(Date.now() / this.options.discovery.autoDiscoveryInterval) *
        this.options.discovery.autoDiscoveryInterval -
        Date.now()
    )
    log.verbose(
      `Next automatic discovery for ${this.options.name} will be in ${Math.ceil(
        nextDiscovery / 1000
      )} seconds.`
    )
    setTimeout(() => this.startDiscovery(), nextDiscovery)
  }

  protected startAcquisition() {
    log.info(`Starting automatic data acquisition for ${this.options.name}...`)
    this.acquisitionTimer = setInterval(
      () => this.updateValues(),
      this.options.updateInterval
    )
  }

  protected endAcquisition() {
    if (!this.acquisitionTimer) return
    log.info(`Terminating data acquisition for ${this.options.name}.`)
    clearInterval(this.acquisitionTimer)
    this.acquisitionTimer = null
  }

  private async discoverObjects() {
    if (this.discoveryInProgress) return
    this.discoveryInProgress = true

    let discoverResponse = await this.makeRequest(this.options.discovery)
      .then((response: any) => {
        this.discoveryInProgress = false
        this.endDiscovery()
        return response.json()
      })
      .catch((error: Error) => {
        log.warn(
          `Failed in discovery request for controller ${this.options.name}.`
        )
        log.error(`  ${error.message}`)
        log.debug(`  ${error.stack}`)
        this.discoveryInProgress = false
      })

    if (!discoverResponse) {
      this.discoveryInProgress = false
      return
    }

    // The set we're interested in might not be the direct response
    const lastResponse = this.lastDiscoverResponse
    this.lastDiscoverResponse = discoverResponse
    if (this.options.discovery.responseToSet) {
      discoverResponse = this.options.discovery.responseToSet(
        discoverResponse,
        lastResponse
      )
    }

    const objectResponse = Array.isArray(discoverResponse)
      ? discoverResponse
      : Object.keys(discoverResponse).map((dev: any) => {
          return {
            ...discoverResponse[dev],
            responseIdKey: dev,
          }
        })

    let discoveredInstances = 0
    objectResponse.forEach((instance: any) => {
      const instanceKey = this.options.discovery.instanceToKey(instance)
      if (this.instances[instanceKey] === undefined) {
        if (this.options.discovery.filter) {
          if (!this.options.discovery.filter(instance)) {
            log.verbose(
              `Excluding filtered instance ${instanceKey} on ${this.options.name}.`
            )
            return
          }
        }
        // Create
        log.verbose(
          `Discovered new instance ${instanceKey} on ${this.options.name}.`
        )
        this.instances[instanceKey] = new APIInstance({
          connection: this,
          identifier: instanceKey,
          newlyDiscovered: true,
        })
        discoveredInstances++
      }
      this.instances[instanceKey].consumeStatic(instance, objectResponse)
    })

    if (discoveredInstances) {
      log.info(
        `Discovered ${discoveredInstances} new devices on controller ${this.options.name}.`
      )
    }
  }

  private async updateValues() {
    if (this.acquisitionInProgress) return
    this.acquisitionInProgress = true

    if (this.options.acquisition.behaviour !== APIAcquisitionBehaviour.All) {
      throw new Error(
        'API requests to services which do not return all values have not yet been implemented.'
      )
    }

    let acquisitionResponse: any
    try {
      acquisitionResponse = await this.makeRequest(
        this.options.acquisition
      ).then((response: any) => {
        this.acquisitionInProgress = false
        return response.json()
      })
    } catch (error) {
      log.warn(
        `Failed in acquisition request for controller ${this.options.name}.`
      )
      log.warn(`  ${error.message}`)
      log.debug(`  ${error.stack}`)
      this.acquisitionInProgress = false
      return
    }

    // The set we're interested in might not be the direct response
    const lastResponse = this.lastAcquisitionResponse
    this.lastAcquisitionResponse = acquisitionResponse
    if (this.options.acquisition.responseToSet) {
      acquisitionResponse = this.options.acquisition.responseToSet(
        acquisitionResponse,
        lastResponse
      )
    }

    // Converted key-values to a basic array
    acquisitionResponse = Array.isArray(acquisitionResponse)
      ? acquisitionResponse
      : Object.keys(acquisitionResponse).map((dev: any) => {
          return {
            ...acquisitionResponse[dev],
            responseIdKey: dev,
          }
        })

    if (this.options.acquisition.behaviour === APIAcquisitionBehaviour.All) {
      if (!Array.isArray(acquisitionResponse)) {
        log.warn(
          'API request for updated data returned non-array response when array is expected.'
        )
        setTimeout(
          () => this.updateValues(),
          this.options.acquisition.retryInterval || 5000
        )
        this.acquisitionInProgress = false
        return
      }

      acquisitionResponse.forEach((instance: any) => {
        const instanceKey = this.options.acquisition.instanceToKey(instance)
        if (!this.instances[instanceKey]) {
          if (
            !this.options.discovery.filter ||
            this.options.discovery.filter(instance)
          ) {
            log.debug(
              `Encountered API response for '${instanceKey}' previously unknown. Discovery should be repeated.`
            )
          }
          return
        }
        this.instances[instanceKey].consumeData(instance, acquisitionResponse)
      })

      log.info(
        `Successfully updated '${this.options.name}' with ${acquisitionResponse.length} items.`
      )
    }

    this.acquisitionInProgress = false
  }

  private makeRequest(request: APIRequestOptions) {
    const protocol =
      this.options.protocol.toUpperCase() === 'HTTPS' ? 'https' : 'http'
    const credentials =
      request.username && request.password
        ? `${request.username}:${request.password}@`
        : ''
    const hostname = this.options.address || this.options.ip
    const path = request.path() || '/'
    return new Promise((resolve: Function, reject: Function) => {
      setTimeout(() => {
        reject(new Error('Request has timed out.'))
      }, 60000)
      return fetch(`${protocol}://${credentials}${hostname}${path}`, <any>{
        timeout: 60000,
      }).then((response: any) => {
        if ([4, 5].indexOf(~~response.status.toString().substr(0, 1)) >= 0) {
          reject(new Error(`Request received ${response.status} status.`))
        }
        resolve(response)
      })
    })
  }
}
