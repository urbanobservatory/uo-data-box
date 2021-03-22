import { Model } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'

@cacheResource({
  expiration: 3600,
  uniqueId: 'organisationId',
})
export class Organisation extends StorageBase {
  static tableName: string = SQL.TableName('organisation')

  // Table attributes
  public organisationId!: string
  public name!: string
}
