import { StorageBase, SQL } from 'shared/drivers/sql/index'

import { Data, DataProperties } from './data'

export class DataInteger extends Data {
  static tableName: string = SQL.TableName('data_int')

  static insertBuffer: DataProperties[] = []
  static insertTimer: any = null
  static insertInProgress: boolean = false

  // Table attributes
  public value!: number
}
