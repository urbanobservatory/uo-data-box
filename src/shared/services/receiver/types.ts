export interface IncomingStream {
  brokerage: {
    broker: {
      id: string;
      meta?: any;
    }
    id: string;
    meta?: any;
  };
  entity: {
    name: string;
    meta?: any;
  };
  feed: {
    metric: string;
    meta?: any;
  };
  timeseries: {
    unit: string;
    value: {
      time: Date;
      timeAccuracy: number;
      data: any;
      type: string;
    }
  }
}
