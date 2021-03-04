import * as HTTP from 'http'
import * as WebSocket from 'ws'

import { log } from 'shared/services'

import { WebsocketServer } from './server'
import { WebsocketFrame, WebsocketRecipients, WebsocketSignal } from '../types'

export class WebsocketServerClient {
  private socket: WebSocket
  private remoteAddress: string
  private remotePort: number
  private server: WebsocketServer

  constructor(
    ws: WebSocket,
    request: HTTP.IncomingMessage,
    parentServer: WebsocketServer
  ) {
    this.socket = ws
    this.remoteAddress = String(request.connection.remoteAddress)
    this.remotePort = Number(request.connection.remotePort)
    this.server = parentServer
    this.addEventListeners()
    log.verbose(
      `New WebSocket connection established with ${this.remoteAddress}:${this.remotePort}.`
    )
    this.send({
      signal: WebsocketSignal.CONNECTION_INITIATED,
      recipients: WebsocketRecipients.RECIPIENTS_INDIVIDUAL,
      data: {
        serverTime: Date.now(),
      },
    })
  }

  private addEventListeners() {
    this.socket.on('close', () => this.handleDisconnect())
  }

  private handleDisconnect() {
    log.verbose(
      `Connection over Websocket from ${this.remoteAddress}:${this.remotePort} was closed.`
    )
    this.server.handleDisconnection(this)
  }

  public getUniqueID() {
    return `${this.remoteAddress}:${this.remotePort}`
  }

  public close() {
    log.verbose(
      `Closing a WebSocket connection to ${this.remoteAddress}:${this.remotePort}...`
    )
    this.send({
      signal: WebsocketSignal.CONNECTION_TERMINATED,
      recipients: WebsocketRecipients.RECIPIENTS_INDIVIDUAL,
      data: {
        serverTime: Date.now(),
      },
    })
    try {
      this.socket.close()
    } catch (e) {}
  }

  public send(frame: WebsocketFrame) {
    this.socket.send(JSON.stringify(frame))
  }
}
