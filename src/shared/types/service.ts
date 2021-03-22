import { Model } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'

import { Condition } from './condition'

@cacheResource({
  expiration: 3600,
  uniqueId: 'serviceId',
})
export class Service extends StorageBase {
  static tableName: string = SQL.TableName('service')

  // Table attributes
  public serviceId!: string
  public time!: Date
  public notes!: string
  public sensor!: string

  private condition!: Condition

  // Table relations
  static relationMappings = {
    condition: {
      relation: Model.HasOneRelation,
      modelClass: Condition,
      join: {
        from: `${SQL.TableName('service')}.condition_id`,
        to: `${SQL.TableName('condition')}.condition_id`,
      },
    },
  }
}
