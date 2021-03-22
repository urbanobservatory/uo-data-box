import { Model, Transaction } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'
import { UnitProperties } from './unit'
import { Assessment } from './assessment'
import { Aggregation } from './aggregation'
import { Derivative } from './derivative'
import { Brokerage } from './brokerage'

export interface StorageProperties {
  storageId?: number
  name: string
  suffix?: string
}

@cacheResource({
  expiration: 3600,
  uniqueId: 'storageId',
})
export class Storage extends StorageBase {
  static tableName: string = SQL.TableName('storage')
  static idColumn: string = 'storage_id'

  // Table attributes
  public storageId!: number
  public name!: string
  public suffix!: string

  public static async assert(
    u: StorageProperties,
    trx?: Transaction,
    instance?: Storage | false
  ): Promise<any> {
    let storageId = u.storageId || (instance && instance.storageId)
    let storage: Storage = new Storage()

    if (!storageId || !instance) {
      instance = await this.getByName(u.name)
      if (instance) storageId = instance.storageId
    }

    if (!storageId) {
      storage = await this.create(u, trx)
    }

    if (!instance && storageId) {
      instance = await Storage.getById(storageId, trx)
    }

    if (instance && instance.shouldPatch(u)) {
      await this.query(trx)
        .skipUndefined()
        .patch(<any>{ ...u })
        .where({
          storage_id: instance.storageId,
        })
      storage = await Storage.getById(instance.storageId, trx)
    }

    return storage.storageId || instance
  }

  public static async create(
    u: UnitProperties,
    trx?: Transaction
  ): Promise<any> {
    const storage = await this.query(trx)
      .skipUndefined()
      .insert(<any>{
        ...u,
      })
    return storage
  }

  public static async getById(
    storageId: number,
    trx?: Transaction
  ): Promise<Storage> {
    return await this.namedQuery(
      `Get storage with the ID '${storageId}'`,
      trx
    ).findOne({ storage_id: storageId })
  }

  public static async getByName(
    name: string,
    trx?: Transaction
  ): Promise<Storage> {
    return await this.namedQuery(
      `Get storage from name '${name}'`,
      trx
    ).findOne({ name: name })
  }

  public isEquivalent(o: StorageProperties) {
    // This is a special case, if the unit name changes then we might need to
    // create a new unit row.
    if (this.name && o.name && this.name !== o.name) return false

    if (super.isEquivalent(o)) {
      return true
    }

    return true
  }
}
