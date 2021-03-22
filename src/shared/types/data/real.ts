import { StorageBase, SQL } from 'shared/drivers/sql/index'

import { Data, DataProperties } from './data'

export class DataReal extends Data {
  static tableName: string = SQL.TableName('data_real')

  static insertBuffer: DataProperties[] = []
  static insertTimer: any = null
  static insertInProgress: boolean = false

  // Table attributes
  public value!: number
}
