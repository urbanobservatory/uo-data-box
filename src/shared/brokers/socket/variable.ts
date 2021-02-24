import {Downloader} from 'shared/services/downloader';
import {events} from 'shared/services/events';
import {log} from 'shared/services/log';

import {SocketController, SocketValueDescription} from './controller';
import {Datapoint} from '../datapoint';

const fileDownloader = new Downloader();

export interface SocketVariableOptions {
  connection?: SocketController;
  identifier?: string;
  description?: SocketValueDescription;
}

export class SocketVariable extends Datapoint {
  protected connection: any;
  private options: SocketVariableOptions;
  private previousSeen: Date = null;
  private lastSeen: Date = null;
  private lastUpdated: Date = null;
  private lastValue: any = null;

  constructor (options: SocketVariableOptions) {
    super(options);
    this.options = options;
  }

  public getDataEntry() {
    const entryMetadata = this.connection.getOptions().getMetadata({
      presentValue: this.lastValue,
      description: this.options.description
    });
    if (!entryMetadata) return null;

    return {
      brokerage: {
        broker: {
          id: this.connection.getName(),
          meta: {
            ...entryMetadata.broker
          }
        },
        id: this.options.identifier,
        meta: {
          ...entryMetadata.brokerage
        }
      },
      entity: {
        name: entryMetadata.entityName,
        meta: {
          ...entryMetadata.entity
        }
      },
      feed: {
        metric: entryMetadata.metricName,
        meta: {
          ...entryMetadata.metric
        }
      },
      timeseries: {
        unit: entryMetadata.unit,
        value: {
          time: entryMetadata.valueTime || this.lastUpdated,
          timeAccuracy: this.lastSeen && this.previousSeen ?
            ((this.lastSeen.getTime() - this.previousSeen.getTime()) / 1000) :
            0.0,
          data: this.lastValue,
          type: entryMetadata.targetType
        }
      }
    };
  }

  public consumeData(updatedValue: any, updatedSet: any) {
    this.previousSeen = this.lastSeen;
    this.lastSeen = new Date();

    let comparator = this.connection.getOptions().acquisition.instanceComparator;
    if (!comparator) {
      comparator = (oldData: any, newData: any) => JSON.stringify(oldData) !== JSON.stringify(newData)
    }

    if (this.lastValue === null) {
      log.verbose(
        `Socket value '${this.options.description.name}' has initial value ${updatedValue}.`
      );
    } else {
      if (!comparator(this.lastValue, updatedValue)) {
        // Data has not changed
        return;
      }

      log.verbose(
        `Socket value '${this.options.description.name}' updated from ${this.lastValue} to ${updatedValue}.`
      );
    }

    events.emit('sensor:cov:api', {
      controller: this.connection,
      sensor: this,
      oldValue: this.lastValue,
      newValue: updatedValue
    });

    this.lastValue = updatedValue;
    this.lastUpdated = new Date();

    this.sendDataEntry();
  }
}
