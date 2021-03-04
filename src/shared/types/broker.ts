import { Model, Transaction } from 'objection'

import { cacheResource } from '../drivers/cache'
import { StorageBase, SQL } from '../drivers/sql'

export interface BrokerProperties {
  brokerId?: string
  name: string
  active?: boolean
}

@cacheResource({
  expiration: 3600,
  uniqueId: 'brokerId',
})
export class Broker extends StorageBase implements BrokerProperties {
  static tableName: string = SQL.TableName('broker')
  static idColumn: string = 'broker_id'

  // Table attributes
  public brokerId!: string
  public name!: string
  public active!: boolean
  public meta: any

  public static async assert(
    p: BrokerProperties,
    trx?: Transaction,
    instance?: Broker
  ): Promise<any> {
    let brokerId = p.brokerId || (instance && instance.brokerId)
    let broker: any = null

    if (!brokerId && p.name) {
      broker = await this.getByName(p.name, trx)
      if (broker) brokerId = broker.brokerId
    }

    if (!brokerId) {
      broker = await this.create({ ...p }, trx)
    }

    if (!instance && p.brokerId) {
      instance = await Broker.getById(p.brokerId, trx)
    }

    if (instance && instance.shouldPatch(p)) {
      await this.query(trx)
        .skipUndefined()
        .patch(<any>{ ...p })
        .where({
          broker_id: instance.brokerId,
        })
      broker = await Broker.getById(instance.brokerId, trx)
    }

    return broker || instance
  }

  public static async create(
    p: BrokerProperties,
    trx?: Transaction
  ): Promise<any> {
    const broker = await this.query(trx).insert(<any>{
      name: p.name,
      active: p.active || false,
    })
    return broker
  }

  public static async getById(
    brokerId: string,
    trx?: Transaction
  ): Promise<Broker> {
    return await this.namedQuery(
      `Get broker with the ID '${brokerId}'`,
      trx
    ).findOne({ broker_id: brokerId })
  }

  public static async getByName(name: string, trx?: Transaction) {
    return await this.namedQuery(
      `Get broker with the name '${name}'`,
      trx
    ).findOne({ name })
  }
}
