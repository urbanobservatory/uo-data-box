import { Model } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'

@cacheResource({
  expiration: 3600,
  uniqueId: 'contactId',
})
export class Contact extends StorageBase {
  static tableName: string = SQL.TableName('contact')

  // Table attributes
  public contactId!: string
  public name!: string
  public email!: string
  public phone!: string
}
