import * as HTTP from 'http'
import * as WebSocket from 'ws'

import { events, log } from 'shared/services'

import { WebsocketServerClient } from './client'
import { WebsocketFrame, WebsocketRecipients, WebsocketSignal } from '../types'

interface WebsocketServerOptions {
  port: number
}

export class WebsocketServer {
  private options: WebsocketServerOptions
  private listening?: boolean
  private instance?: WebSocket.Server
  private clients: { [key: string]: WebsocketServerClient } = {}

  constructor(options: WebsocketServerOptions) {
    this.options = options
    this.addEventListeners()
  }

  private addEventListeners() {
    events.on('app:end:*', () => {
      if (!this.instance) return
      log.info(
        `Received app termination notification. Should terminate Websocket connections...`
      )
      this.stopListening()
    })
  }

  public async startListening() {
    if (this.instance) {
      log.warn(
        'Websocket server already exists. Attempting to destroy first...'
      )
      await this.stopListening()
    }
    return new Promise((resolve: Function, reject: Function) => {
      log.info(
        `Creating new Websocket server to listen on port ${
          this.options.port || 8080
        }...`
      )
      this.instance = new WebSocket.Server({
        ...this.options,
      })
      this.instance.on('listening', () => {
        this.listening = true
        log.info('Websocket connections now available.')
        resolve()
      })
      this.instance.on('connection', (ws: any, request: any) => {
        return this.handleConnection(ws, request)
      })
    })
  }

  public async stopListening() {
    log.info('Closing Websocket server to new connections...')
    this.listening = false
    if (this.instance) this.instance.close()
    log.info('Closing existing Websocket connections...')
    Object.values(this.clients).forEach((client: WebsocketServerClient) => {
      client.close()
    })
    this.clients = {}
    log.info('Websocket closure completed.')
  }

  private handleConnection(ws: WebSocket, request: HTTP.IncomingMessage) {
    const client = new WebsocketServerClient(ws, request, this)
    this.clients[client.getUniqueID()] = client
  }

  public handleDisconnection(client: WebsocketServerClient) {
    delete this.clients[client.getUniqueID()]
  }

  public getClientCount() {
    return Object.keys(this.clients).length
  }

  public getClientArray(): WebsocketServerClient[] {
    return Object.values(this.clients)
  }

  public broadcast(frame: WebsocketFrame) {
    this.getClientArray().forEach((client: WebsocketServerClient) => {
      client.send({
        ...frame,
        recipients: WebsocketRecipients.RECIPIENTS_ALL,
      })
    })
  }
}
