import {Model} from 'objection';

import {cacheResource} from '../drivers/cache';
import {StorageBase, SQL} from '../drivers/sql';
import {Spatial} from './spatial';

export interface PositionProperties {
  positionId?: string;
  description: string;
  notes?: string;
  installed?: Date;
  meta: any;
}

@cacheResource({
  expiration: 3600,
  uniqueId: 'positionId'
})
export class Position extends StorageBase implements PositionProperties {
  static tableName: string = SQL.TableName('position');

  // Table attributes
  public positionId: string;
  public description: string;
  public notes: string;
  public installed: Date;
  public meta: any;

  public spatial: Spatial;

  // Table relations
  static relationMappings = {
    spatial: {
      relation: Model.HasManyRelation,
      modelClass: Spatial,
      join: {
        from: `${SQL.TableName('position')}.position_id`,
        to: `${SQL.TableName('spatial')}.position_id`
      }
    }
  }
}
