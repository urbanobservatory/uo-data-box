import {Config} from 'shared/services/config';
import {StorageBase, SQL} from 'shared/drivers/sql/index';

import {Data, DataProperties} from './data';

export class DataFile extends Data {
  static tableName: string = SQL.TableName('data_file');

  static insertBuffer: DataProperties[] = [];
  static insertTimer: any = null;
  static insertInProgress: boolean = false;

  public toOutput(): any {
    const record: DataProperties = <DataProperties>this.toJSON();
    return {
      ...record,
      value: record.value.replace(/^public\//, Config.getValue('web_file_base'))
    };
  }
}
