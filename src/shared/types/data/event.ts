import { StorageBase, SQL } from 'shared/drivers/sql/index'

import { Data, DataProperties } from './data'

export class DataEvent extends Data {
  static tableName: string = SQL.TableName('data_event')

  static insertBuffer: DataProperties[] = []
  static insertTimer: any = null
  static insertInProgress: boolean = false
}
