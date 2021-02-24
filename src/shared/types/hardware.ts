import {Model} from 'objection';

import {cacheResource} from '../drivers/cache';
import {StorageBase, SQL} from '../drivers/sql';

@cacheResource({
  expiration: 3600,
  uniqueId: 'hardwareId'
})
export class Hardware extends StorageBase {
  static tableName: string = SQL.TableName('hardware');

  // Table attributes
  public hardwareId: string;
  public serial: string;
  public information: any;
  public purchased: Date;
}
