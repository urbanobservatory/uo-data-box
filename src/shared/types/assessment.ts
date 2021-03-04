import { Model } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'

@cacheResource({
  expiration: 3600,
  uniqueId: 'assessmentId',
})
export class Assessment extends StorageBase {
  static tableName: string = SQL.TableName('assessment')

  // Table attributes
  public assessmentId!: string
  public description!: string
  public explanation!: string
  public criteria!: string
}
