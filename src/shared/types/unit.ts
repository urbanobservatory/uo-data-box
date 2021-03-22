import { Model, Transaction } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'
import { Broker } from './broker'

export interface UnitProperties {
  unitId?: string
  name: string
}

@cacheResource({
  expiration: 3600,
  uniqueId: 'unitId',
})
export class Unit extends StorageBase {
  static tableName: string = SQL.TableName('unit')
  static idColumn: string = 'unit_id'

  // Table attributes
  public unitId!: string
  public name!: string

  public static async assert(
    u: UnitProperties,
    trx?: Transaction,
    instance?: Unit | false
  ): Promise<any> {
    let unitId = u.unitId || (instance && instance.unitId)
    let unit: Unit = new Unit()

    if (!unitId || !instance) {
      instance = await this.getByName(u.name)
      if (instance) unitId = instance.unitId
    }

    if (!unitId) {
      unit = await this.create(u, trx)
    }

    if (!instance && unitId) {
      instance = await Unit.getById(unitId, trx)
    }

    if (instance && instance.shouldPatch(u)) {
      await this.query(trx)
        .skipUndefined()
        .patch(<any>{ ...u })
        .where({
          unit_id: instance.unitId,
        })
      unit = await Unit.getById(instance.unitId, trx)
    }

    return unit.unitId || instance
  }

  public static async create(
    u: UnitProperties,
    trx?: Transaction
  ): Promise<any> {
    const unit = await this.query(trx)
      .skipUndefined()
      .insert(<any>{
        ...u,
      })
    return unit
  }

  public static async getById(
    unitId: string,
    trx?: Transaction
  ): Promise<Unit> {
    return await this.namedQuery(
      `Get unit with the ID '${unitId}'`,
      trx
    ).findOne({ unit_id: unitId })
  }

  public static async getByName(
    name: string,
    trx?: Transaction
  ): Promise<Unit> {
    return await this.namedQuery(`Get unit from name '${name}'`, trx).findOne({
      name: name,
    })
  }

  public isEquivalent(o: UnitProperties) {
    // This is a special case, if the unit name changes then we might need to
    // create a new unit row.
    if (this.name && o.name && this.name !== o.name) return false

    if (super.isEquivalent(o)) {
      return true
    }

    return true
  }
}
