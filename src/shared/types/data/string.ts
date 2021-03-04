import { StorageBase, SQL } from 'shared/drivers/sql/index'

import { Data, DataProperties } from './data'

export class DataString extends Data {
  static tableName: string = SQL.TableName('data_string')

  static insertBuffer: DataProperties[] = []
  static insertTimer: any = null
  static insertInProgress: boolean = false

  // Table attributes
  public value!: string
}
