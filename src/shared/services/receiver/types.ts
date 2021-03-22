export interface IncomingStream {
  brokerage: {
    broker: {
      id: string
      meta?: any
    }
    // FIXME: this shouldn't be undefined when added
    id: string | undefined
    meta?: any
  }
  platform: {
    name: string
    meta?: any
  }
  sensor: {
    observedProperty: string
    meta?: any
  }
  timeseries: {
    unit: string
    value: {
      time: Date | null
      timeAccuracy: number | null
      data: any
      type: string
    }
  }
}
