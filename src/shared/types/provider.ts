import { Model } from 'objection'

import { cacheResource } from 'shared/drivers/cache'
import { RequestDetail, StorageBase, SQL } from 'shared/drivers/sql'
import { Contact } from './contact'
import { Licence } from './licence'
import { Organisation } from './organisation'
import { Timeseries } from './timeseries'
import { Brokerage } from './brokerage'

@cacheResource({
  expiration: 3600,
  uniqueId: 'providerId',
})
export class Provider extends StorageBase {
  static tableName: string = SQL.TableName('provider')

  // Table attributes
  public providerId!: string
  public organisation!: Organisation
  public contact!: Contact
  public licence!: Licence

  // Table relations
  static relationMappings = {
    licence: {
      relation: Model.HasOneRelation,
      modelClass: Licence,
      join: {
        from: `${SQL.TableName('provider')}.licence_id`,
        to: `${SQL.TableName('licence')}.licence_id`,
      },
    },
    contact: {
      relation: Model.HasOneRelation,
      modelClass: Contact,
      join: {
        from: `${SQL.TableName('provider')}.contact_id`,
        to: `${SQL.TableName('contact')}.contact_id`,
      },
    },
    organisation: {
      relation: Model.HasOneRelation,
      modelClass: Organisation,
      join: {
        from: `${SQL.TableName('provider')}.organisation_id`,
        to: `${SQL.TableName('organisation')}.organisation_id`,
      },
    },
  }

  public async toFilteredJSON(
    parent?: any,
    requestDetail: RequestDetail = {}
  ): Promise<any> {
    return {
      ...this.toJSON(),
      licenceId: undefined,
      organisationId: undefined,
      contactId: undefined,
    }
  }
}
