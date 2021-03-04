import { Model } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'

@cacheResource({
  expiration: 3600,
  uniqueId: 'conditionId',
})
export class Condition extends StorageBase {
  static tableName: string = SQL.TableName('condition')

  // Table attributes
  public conditionId!: string
  public name!: string
  public description!: string
}
