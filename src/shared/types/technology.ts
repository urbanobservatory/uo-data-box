import {Model} from 'objection';

import {cacheResource} from '../drivers/cache';
import {StorageBase, SQL} from '../drivers/sql';
import {Organisation} from './organisation';

@cacheResource({
  expiration: 3600,
  uniqueId: 'technologyId'
})
export class Technology extends StorageBase {
  static tableName: string = SQL.TableName('technology');

  // Table attributes
  public technologyId: string;
  public organisationId: string;
  public model: string;
  public datasheet: string;

  private organisation: Organisation;

  // Table relationships
  static relationMappings = {
    _organisation: {
      relation: Model.HasOneRelation,
      modelClass: Organisation,
      join: {
        from: `${SQL.TableName('technology')}.organisation_id`,
        to: `${SQL.TableName('organisation')}.organisation_id`
      }
    }
  }
}
