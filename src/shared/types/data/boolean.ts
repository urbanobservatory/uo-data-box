import {StorageBase, SQL} from 'shared/drivers/sql/index';

import {Data, DataProperties} from './data';

export class DataBoolean extends Data {
  static tableName: string = SQL.TableName('data_bool');

  static insertBuffer: DataProperties[] = [];
  static insertTimer: any = null;
  static insertInProgress: boolean = false;

  // Table attributes
  public value: boolean;
}
