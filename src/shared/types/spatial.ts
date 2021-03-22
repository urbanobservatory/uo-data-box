import { Model } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'
import { Position } from '../types'

@cacheResource({
  expiration: 3600,
  uniqueId: 'spatialId',
})
export class Spatial extends StorageBase {
  static tableName: string = SQL.TableName('spatial')

  // Table attributes
  public spatialId!: string
  public position!: Position
  public description!: string
  public geometry!: string
}
