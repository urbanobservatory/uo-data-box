import { StorageBase, SQL } from 'shared/drivers/sql/index'

import { Data, DataProperties } from './data'

export class DataTimestamp extends Data {
  static tableName: string = SQL.TableName('data_ts')

  static insertBuffer: DataProperties[] = []
  static insertTimer: any = null
  static insertInProgress: boolean = false

  // Table attributes
  public value!: Date
}
