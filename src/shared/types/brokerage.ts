import { Model, Transaction } from 'objection'

import { cacheResource } from '../drivers/cache'
import { RequestDetail, StorageBase, SQL } from '../drivers/sql'

import { Broker, BrokerProperties } from './broker'
import { Timeseries } from './timeseries'

export interface BrokerageProperties {
  brokerageId?: string
  brokerId?: string
  sensorId?: string
  sourceId?: string
  meta?: any
  broker?: BrokerProperties
}

@cacheResource({
  expiration: 3600,
  uniqueId: 'brokerageId',
})
export class Brokerage extends StorageBase implements BrokerageProperties {
  static tableName: string = SQL.TableName('brokerage')
  static idColumn: string = 'brokerage_id'
  static defaultEager: string = `broker`

  // Table attributes
  public brokerageId!: string
  public brokerId!: string
  public sensorId!: string
  public sourceId!: string
  public meta!: any

  public broker!: Broker

  // Table relations
  static relationMappings = {
    broker: {
      relation: Model.HasOneRelation,
      modelClass: Broker,
      join: {
        from: `${SQL.TableName('brokerage')}.broker_id`,
        to: `${SQL.TableName('broker')}.broker_id`,
      },
    },
  }

  public static async getSensorIdFromBrokerage(criteria: {
    sourceId: string | undefined
    brokerName: string | undefined
  }): Promise<any> {
    const { brokerName, sourceId } = criteria
    if (brokerName == undefined) return
    const broker: Broker = await Broker.getByName(brokerName)
    if (!broker) {
      return undefined
    }

    const brokerage = await this.namedQuery(
      `Get brokerage for source ID '${sourceId}' and broker '${brokerName}'`
    ).findOne({
      source_id: sourceId,
      broker_id: broker.brokerId,
    })

    if (!brokerage) {
      return undefined
    }

    return brokerage.sensorId
  }

  public static async assert(
    p: BrokerageProperties,
    trx?: Transaction,
    instance?: Brokerage
  ): Promise<any> {
    let brokerageId = p.brokerageId || (instance && instance.brokerageId)
    let brokerage: any = null

    if (p.broker) {
      const broker = await Broker.assert(
        p.broker,
        trx,
        instance && instance.broker
      )

      if (!brokerageId) {
        brokerage = await this.create({ ...p, brokerId: broker.brokerId }, trx)
      }
    }
    if (!instance && p.brokerageId) {
      instance = await Brokerage.getById(p.brokerageId, trx)
    }

    if (instance && instance.shouldPatch(p)) {
      await this.query(trx)
        .skipUndefined()
        .patch(<any>{ ...p })
        .where({
          brokerage_id: instance.brokerageId,
        })
      brokerage = await Brokerage.getById(instance.brokerageId, trx)
    }

    return brokerage || instance
  }

  public static async create(
    p: BrokerageProperties,
    trx?: Transaction
  ): Promise<any> {
    const broker = await this.query(trx).insert(<any>{
      brokerId: p.brokerId,
      sensorId: p.sensorId,
      sourceId: p.sourceId,
      meta: p.meta,
    })
    return broker
  }

  public static async getById(
    brokerageId: string,
    trx?: Transaction
  ): Promise<Brokerage> {
    return await this.namedQuery(
      `Get brokerage with the ID '${brokerageId}'`,
      trx
    )
      .findOne({ brokerage_id: brokerageId })
      .eager(`[ ${Brokerage.defaultEager} ]`)
  }

  public isEquivalent(o: BrokerageProperties) {
    if (super.isEquivalent(o)) {
      return true
    }

    if (this.sensorId && o.sensorId && this.sensorId !== o.sensorId)
      return false

    if (this.sourceId && o.sourceId && this.sourceId !== o.sourceId)
      return false

    if (this.brokerId && o.brokerId && this.brokerId !== o.brokerId)
      return false

    return true
  }

  public async toFilteredJSON(
    parent?: any,
    requestDetail: RequestDetail = {}
  ): Promise<any> {
    const baseJSON: any = this.toJSON()
    if (parent) {
      baseJSON.sensorId = undefined
      baseJSON.brokerId = undefined
    }
    return baseJSON
  }
}
