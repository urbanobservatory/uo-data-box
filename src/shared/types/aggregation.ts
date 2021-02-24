import {Model} from 'objection';

import {cacheResource} from '../drivers/cache';
import {StorageBase, SQL} from '../drivers/sql';

@cacheResource({
  expiration: 3600,
  uniqueId: 'aggregationId'
})
export class Aggregation extends StorageBase {
  static tableName: string = SQL.TableName('aggregation');

  // Table attributes
  public aggregationId: string;
  public name: string;
  public method: string;
  public interval: number;
}
