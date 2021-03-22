import { Model } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'

@cacheResource({
  expiration: 3600,
  uniqueId: 'deploymentId',
})
export class Deployment extends StorageBase {
  static tableName: string = SQL.TableName('deployment')

  // Table attributes
  public deploymentId!: string
  public name!: string
  public description!: string
  public started!: Date
  public active!: boolean
  public notes!: string
  //   public public!: boolean
}
