import * as KNX from 'knx';
import {log} from 'shared/services';

import {KNXController} from './controller';
import {Datapoint} from '../datapoint';

const KNX_WRITE_DELAY = 100; // Millisecond delay after writing

export interface KNXAddressOptions {
  address: string;
  type?: KNXDataTypes;
  index?: number;
  connection?: KNXController;
}

export interface KNXAddressStatistics {
  minimumLength: number;
  maximumLength: number;
  changeCount: number;
  writeCount: number;
  minimumValue: number;
  maximumValue: number;
}

export enum KNXDataTypes {
  Switch = 'DPT1',
  Priority = 'DPT2',
  Dimming = 'DPT3',
  Character = 'DPT4',
  Unsigned8 = 'DPT5',
  Signed8 = 'DPT6',
  Unsigned16 = 'DPT7',
  Signed16 = 'DPT8',
  Float32 = 'DPT9',
  Time = 'DPT10',
  Date = 'DPT11',
  Unsigned32 = 'DPT12',
  Signed32 = 'DPT13',
  Float64 = 'DPT14',
  Access = 'DPT15',
  ASCIIString = 'DPT16',
  Scene = 'DPT17',
  HVAC = 'DPT20',
  Unsigned8Triple = 'DPT232'
}

export class KNXAddress extends Datapoint {
  private options: KNXAddressOptions;
  private datapoint: any;
  protected connection: any;

  private currentValue: any = undefined;
  private statistics: KNXAddressStatistics = undefined;
  private lastSeen: Date = null;
  private lastUpdated: Date = null;

  constructor (options: KNXAddressOptions) {
    super(options);
    this.options = {
      type: KNXDataTypes.Switch,
      index: 1,
      ...options
    };
    this.datapoint = new KNX.Datapoint({
      ga: this.options.address,
      dpt: this.getDatapoint(this.options.type, this.options.index)
    });
    this.lastSeen = new Date();
    this.datapoint.bind(this.options.connection.getConnection());
  }

  public getDataEntry() {
    return {
      brokerage: {
        broker: {
          id: this.connection.getName(),
          meta: {
            tbc: true
          }
        },
        id: this.options.address
      },
      entity: {
        name: 'Generic KNX',
        meta: {
          tbc: true
        }
      },
      feed: {
        metric: this.options.address,
        meta: {
          tbc: true
        }
      },
      timeseries: {
        unit: 'Unknown',
        value: {
          time: this.lastUpdated,
          timeAccuracy: null,
          data: this.currentValue,
          type: 'String'
        }
      }
    };
  }

  public getDatapoint(type: KNXDataTypes, index: number = 1) {
    return `${type}.${('00' + index).substr(-3)}`;
  }

  public getType() {
    return this.options.type;
  }

  public setValue(newValue: any) {
    return new Promise((resolve: Function, reject: Function) => {
      log.info(`KNX - Setting value ${newValue} at address ${this.options.address}`);
      this.datapoint.write(newValue);
      setTimeout(() => resolve(), KNX_WRITE_DELAY);
    });
  }

  public updateStatistics(newValue: Buffer) {
    // There is absolutely no guarantee these are the correct types, and
    // currently the max length of anything in bytes is two but could be
    // higher in future.
    const currentValue: number = newValue.length > 1 ? newValue.readUInt16BE(0) : newValue.readUInt8(0);

    if (this.currentValue === undefined) {
      this.currentValue = currentValue;
      this.statistics = {
        minimumLength: newValue.length,
        maximumLength: newValue.length,
        maximumValue: currentValue,
        minimumValue: currentValue,
        changeCount: 1,
        writeCount: 1
      }
      return;
    }

    this.lastSeen = new Date();
    if (this.currentValue !== currentValue) {
      this.statistics = {
        ...this.statistics,
        minimumLength: Math.min(newValue.length, this.statistics.minimumLength),
        maximumLength: Math.max(newValue.length, this.statistics.maximumLength),
        minimumValue: Math.min(currentValue, this.statistics.minimumValue),
        maximumValue: Math.max(currentValue, this.statistics.maximumValue),
        changeCount: this.statistics.changeCount + 1,
        writeCount: this.statistics.writeCount + 1
      };
      log.verbose(`KNX '${this.options.connection.getName()} ${this.options.address}' changed from ${this.currentValue} to ${currentValue}`);
      this.currentValue = currentValue;
      this.lastUpdated = new Date();
      this.sendDataEntry();
    } else {
      this.statistics.writeCount++;
    }
  }
}
