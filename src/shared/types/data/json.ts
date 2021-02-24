import {StorageBase, SQL} from 'shared/drivers/sql/index';

import {Data, DataProperties} from './data';

export class DataJson extends Data {
  static tableName: string = SQL.TableName('data_json');

  static insertBuffer: DataProperties[] = [];
  static insertTimer: any = null;
  static insertInProgress: boolean = false;

  // Table attributes
  public value: any;

  public toOutput(): any {
    const record: DataProperties = <DataProperties>this.toJSON();

    // Silently fail on invalid JSON
    try {
      record.value = JSON.parse(record.value);
    } catch (e) {}

    return {
      ...record,
      value: record.value
    };
  }
}
