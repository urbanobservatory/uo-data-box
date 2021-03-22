export enum WebsocketSignal {
  CONNECTION_INITIATED,
  CONNECTION_TERMINATED,
  TIMESERIES_STREAM_COV,
}

export enum WebsocketRecipients {
  RECIPIENTS_ALL,
  RECIPIENTS_SUBSCRIBERS,
  RECIPIENTS_INDIVIDUAL,
}

export interface WebsocketFrame {
  signal: WebsocketSignal
  recipients?: WebsocketRecipients
  data: any
}

export interface WebsocketFrameDataConnection {
  serverTime: number
}
