import * as net from 'net'
import { log } from 'shared/services/log'

import { SocketVariable } from './variable'
import { Controller, ControllerOptions } from '../controller'

export interface SocketControllerOptions extends ControllerOptions {
  discovery: SocketDiscoveryOptions
  acquisition: SocketRequestOptions
  address: string
  port: number
  values: SocketValueDescription[]
  getMetadata?: (objectData: any) => { [key: string]: any }
}

export interface SocketValueDescription {
  name: string
  castAs: 'string' | 'float' | 'integer' | 'boolean'
  matrix?: number[]
  length?: number
}

export interface SocketDiscoveryOptions {
  filter?: (a: any) => boolean
}

export interface SocketRequestOptions {
  delimiter: string
  stripCharacters?: boolean
  instanceComparator?: (a: any, b: any, rA?: any, rB?: any) => boolean
}

export class SocketController extends Controller {
  protected classType: string = 'Socket'
  protected options: SocketControllerOptions
  protected connection: any = null
  protected connecting: boolean = false
  protected connected: boolean = false
  protected disconnecting: boolean = false
  protected expectedLength: number = -1

  private receiveBuffer: string = ''
  private variables: { [key: string]: SocketVariable } = {}

  constructor(options: SocketControllerOptions) {
    super()
    this.options = options

    this.expectedLength = 0
    this.options.values.forEach((v: SocketValueDescription) => {
      if (v.matrix) {
        this.expectedLength += v.matrix.reduce(
          (a: number, v: number) => (a *= v),
          1
        )
      } else if (v.length) {
        this.expectedLength += v.length
      } else {
        this.expectedLength++
      }
    })

    log.verbose(
      `Expecting ${this.options.name} to provide ${this.expectedLength} values.`
    )
  }

  public getOptions(): SocketControllerOptions {
    return this.options
  }

  public getMetadata() {
    return {
      protocol: 'Raw TCP/IP',
    }
  }

  // No discovery cycle is necessary for socket connections
  protected startDiscovery() {}
  protected endDiscovery() {}

  protected startAcquisition() {
    log.info(`Starting automatic data acquisition for ${this.options.name}...`)
    this.connect()
  }

  protected endAcquisition() {
    if (this.connection) {
      this.connection.close()
    }
  }

  public async connect(): Promise<any> {
    if (this.connecting) return

    if (this.connected) {
      this.disconnect().then(() => this.startAcquisition())
      return
    }

    this.connecting = true

    return new Promise((resolve: Function, reject: Function) => {
      this.connection = new net.Socket({})

      this.connection.on('data', (d: Buffer) => {
        this.receiveBuffer += d.toString()
        if (
          this.receiveBuffer.length &&
          ['\n', '\r', String.fromCharCode(3)].indexOf(
            this.receiveBuffer.substr(-1)
          ) >= 0
        ) {
          if (this.options.acquisition.stripCharacters) {
            this.receiveBuffer = this.receiveBuffer.replace(
              /[^A-Z0-9.; ,]/gi,
              ''
            )
          }
          const dataItems = this.receiveBuffer.split(
            this.options.acquisition.delimiter
          )

          // Could have a delimiter at the end of the string, which we should ignore
          if (dataItems[dataItems.length - 1] === '') {
            dataItems.pop()
          }

          this.receiveBuffer = ''
          this.processStream(dataItems)
        }
      })
      this.connection.on('close', () => {
        this.connected = false
        this.connecting = false
        this.receiveBuffer = ''
        log.info(`Disconnected socket for ${this.options.name}...`)
        reject()
      })
      this.connection.on('connect', () => {
        this.connecting = false
        this.connected = true
        log.info(`Successfully connected socket for ${this.options.name}...`)
        resolve()
      })

      this.connection.connect(this.options.port, this.options.address)
    })
  }

  public async disconnect(): Promise<any> {
    if (!this.connected || !this.connection) {
      return Promise.resolve()
    }

    return new Promise((resolve: Function, reject: Function) => {
      this.endDiscovery()
      this.endAcquisition()
      this.disconnecting = true
      log.info(`Disconnecting from socket ${this.options.name}...`)
      this.connection = null
      resolve()
    })
  }

  private interpretStream(values: string[]) {
    const streamValues: { [key: string]: any } = {}

    if (values.length !== this.expectedLength) {
      log.warn(
        `Received socket data that does not match expected length from ${this.options.name}.`
      )
      return {}
    }

    this.options.values.forEach((v: SocketValueDescription) => {
      const castValues = (set: string[]) =>
        set.map((s: string) => {
          switch (v.castAs) {
            case 'string':
              return s.trim()
            case 'float':
              return parseFloat(s)
            case 'integer':
              return parseInt(s, 10)
            case 'boolean':
              return !!parseInt(s, 10)
          }
        })

      if (v.matrix) {
        const toMatrix = (arr: any, width: any) =>
          arr.reduce(
            (rows: any, key: any, index: any) =>
              (index % width == 0
                ? rows.push([key])
                : rows[rows.length - 1].push(key)) && rows,
            []
          )
        streamValues[v.name] = toMatrix(
          castValues(
            values.splice(
              0,
              v.matrix.reduce((a: number, v: number) => (a *= v), 1)
            )
          ),
          v.matrix[0]
        )
      } else if (v.length) {
        streamValues[v.name] = castValues(values.splice(0, v.length))
      } else {
        streamValues[v.name] = castValues(values.splice(0, 1)).pop()
      }
    })

    return streamValues
  }

  private processStream(values: string[]) {
    const streamData = this.interpretStream(values)

    Object.keys(streamData).forEach((k: string) => {
      if (this.options.discovery.filter && !this.options.discovery.filter(k)) {
        return
      }

      if (!this.variables[k]) {
        this.variables[k] = new SocketVariable({
          connection: this,
          identifier: k,
          description: this.options.values.find(
            (v: SocketValueDescription) => v.name === k
          ),
        })
      }

      this.variables[k].consumeData(streamData[k], streamData)
    })
  }
}
