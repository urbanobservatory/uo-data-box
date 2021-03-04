import { Model } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'

@cacheResource({
  expiration: 3600,
  uniqueId: 'derivativeId',
})
export class Derivative extends StorageBase {
  static tableName: string = SQL.TableName('derivative')

  // Table attributes
  public derivativeId!: string
  public name!: string
  public equation!: string
}
