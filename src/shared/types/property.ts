import { Model } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'

@cacheResource({
  expiration: 3600,
  uniqueId: 'propertyId',
})
export class Property extends StorageBase {
  static tableName: string = SQL.TableName('property')

  // Table attributes
  public propertyId!: string
  public label!: string
  public description!: string
  public unitId!: string
  public sameAs!: string[]
  public termStatus!: string
}
