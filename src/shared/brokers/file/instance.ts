import {events} from 'shared/services/events';
import {log} from 'shared/services/log';

import {FileController, FileMetric} from './controller';
import {Datapoint} from '../datapoint';

export interface ColumnInstanceOptions {
  connection?: FileController;
  identifier?: string;
}

export class ColumnInstance extends Datapoint {
  protected connection: any;
  private options: ColumnInstanceOptions;
  private instanceData: FileMetric = null;
  private instanceLatest: any = null;
  private instancePending: any[] = [];
  private lastSent: Date = null;

  private sendTimer: any;
  private sendInProgress: boolean = false;

  constructor (options: ColumnInstanceOptions) {
    super(options);
    this.options = options;
  }

  public getDataEntry() {
    return {
      brokerage: {
        broker: {
          id: this.instanceData.broker || this.connection.getName(),
          meta: {}
        },
        id: this.instanceData.key,
        meta: {}
      },
      entity: {
        name: this.instanceData.entity,
        meta: {}
      },
      feed: {
        metric: this.instanceData.metric,
        meta: {}
      },
      timeseries: {
        unit: this.instanceData.units,
        value: {
          time: this.instanceLatest.time,
          timeAccuracy: null,
          data: this.instanceLatest.value,
          type: this.instanceData.type || 'Real'
        }
      }
    };
  }

  public consumeData(instanceData: any) {
    this.instanceData = instanceData;

    const pendingTimeseries = instanceData.timeseries.filter(
      (t: any) => this.lastSent === null || this.lastSent.getTime() < t.time.getTime()
    );

    if (pendingTimeseries.length) {
      log.debug(pendingTimeseries.length + ' timeseries items pending send.');
    }

    this.instancePending = pendingTimeseries;

    if (this.instancePending.length) {
      this.startSending();
    }
  }

  protected startSending() {
    if (this.sendInProgress) return;
    log.info(`Sending timeseries data for for ${this.options.identifier}...`);
    this.sendTimer = setTimeout(() => this.sendNext(), 0);
    this.sendInProgress = true;
  }

  protected endSending() {
    if (!this.sendTimer) return;
    log.info(`Completed sending for ${this.options.identifier}.`);
    clearInterval(this.sendTimer);
    this.sendTimer = null;
    this.sendInProgress = false;
  }

  protected async sendNext() {
    if (!this.instancePending.length) {
      this.endSending();
      return;
    }

    this.instanceLatest = this.instancePending.shift();
    this.lastSent = this.instanceLatest.time;

    await this.sendDataEntry();

    if (this.instancePending) {
      this.sendTimer = setTimeout(() => this.sendNext(), 0);
    }
  }

  public getLastSent(): string {
    return this.lastSent ? this.lastSent.toISOString() : '1970-01-01T00:00:00Z';
  }

  public setLastSent(sent: string) {
    this.lastSent = new Date(sent);
  }
}
