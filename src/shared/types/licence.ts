import { Model } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'

@cacheResource({
  expiration: 3600,
  uniqueId: 'licenceId',
})
export class Licence extends StorageBase {
  static tableName: string = SQL.TableName('licence')

  // Table attributes
  public licenceId!: string
  public name!: string
  public url!: string
  public description!: any
}
