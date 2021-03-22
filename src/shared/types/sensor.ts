import { Model, Transaction, transaction } from 'objection'
import { JSONPath } from 'jsonpath-plus'
import { v4 as uuidv4 } from 'uuid'

import { fuzzyName, uriName } from 'shared/controllers/formatters'
import { generateLinks } from 'shared/services/hateoas'
import { log } from 'shared/services/log'
import { cacheResource, CacheOptions } from 'shared/drivers/cache'
import { RequestDetail, StorageBase, SQL } from 'shared/drivers/sql'

import { Platform } from '.'
import { Broker } from './broker'
import { Brokerage, BrokerageProperties } from './brokerage'
import { Hardware } from './hardware'
import { Provider } from './provider'
import { Property } from './property'
import { Service } from './service'
import { Technology } from './technology'
import { Timeseries, TimeseriesProperties } from './timeseries'
import { Config } from 'shared/services/config'

export interface SensorProperties {
  sensorId?: string
  propertyId: string
  meta: any
  platformId?: string
  providerId?: string
  hardwareId?: string
  technologyId?: string
  provider?: Provider
  property?: Property
  hardware?: Hardware
  technology?: Technology
  brokerage?: BrokerageProperties[]
  timeseries?: TimeseriesProperties[]
}

@cacheResource({
  expiration: 300,
  uniqueId: 'sensorId',
})
export class Sensor extends StorageBase implements SensorProperties {
  static tableName: string = SQL.TableName('sensor')
  static idColumn: string = 'sensor_id'
  static defaultEager: string = `
      brokerage.[
        ${Brokerage.defaultEager}
      ],
      provider.[
        organisation,
        contact,
        licence
      ],
      hardware,
      technology,
      service.[
        condition
      ],
      timeseries.[
        ${Timeseries.defaultEager}
      ]
    `

  // Table attributes
  public sensorId!: string
  public propertyId!: string
  public meta!: any
  public platformId!: string
  public providerId!: string
  public hardwareId!: string
  public technologyId!: string
  public provider!: Provider
  public property!: Property
  public hardware!: Hardware
  public technology!: Technology
  public brokerage!: Brokerage[]
  public timeseries!: Timeseries[]

  // Table relations
  static relationMappings = {
    brokerage: {
      relation: Model.HasManyRelation,
      modelClass: Brokerage,
      join: {
        from: `${SQL.TableName('brokerage')}.sensor_id`,
        to: `${SQL.TableName('sensor')}.sensor_id`,
      },
    },
    provider: {
      relation: Model.HasOneRelation,
      modelClass: Provider,
      join: {
        from: `${SQL.TableName('sensor')}.provider_id`,
        to: `${SQL.TableName('provider')}.provider_id`,
      },
    },
    property: {
      relation: Model.HasOneRelation,
      modelClass: Provider,
      join: {
        from: `${SQL.TableName('sensor')}.property_id`,
        to: `${SQL.TableName('property')}.property_id`,
      },
    },
    hardware: {
      relation: Model.HasOneRelation,
      modelClass: Hardware,
      join: {
        from: `${SQL.TableName('sensor')}.hardware_id`,
        to: `${SQL.TableName('hardware')}.hardware_id`,
      },
    },
    technology: {
      relation: Model.HasOneRelation,
      modelClass: Technology,
      join: {
        from: `${SQL.TableName('sensor')}.technology_id`,
        to: `${SQL.TableName('technology')}.technology_id`,
      },
    },
    service: {
      relation: Model.HasManyRelation,
      modelClass: Service,
      join: {
        from: `${SQL.TableName('service')}.sensor_id`,
        to: `${SQL.TableName('sensor')}.sensor_id`,
      },
    },
    timeseries: {
      relation: Model.HasManyRelation,
      modelClass: Timeseries,
      join: {
        from: `${SQL.TableName('timeseries')}.sensor_id`,
        to: `${SQL.TableName('sensor')}.sensor_id`,
      },
    },
  }

  public static async assert(
    f: SensorProperties,
    trx?: Transaction,
    instance?: Sensor
  ): Promise<any> {
    const sensorId = f.sensorId || (instance && instance.sensorId)
    let sensor: Sensor = new Sensor()

    if (!sensorId) {
      sensor = await this.create(f, trx)
    }

    if (!instance && f.sensorId) {
      instance = await Sensor.getById(f.sensorId, trx)
    }

    if (instance && instance.shouldPatch(f)) {
      await this.query(trx)
        .skipUndefined()
        .patch(<any>{ ...f })
        .where({
          sensor_id: instance.sensorId,
        })
      sensor = await Sensor.getById(instance.sensorId, trx)
    }

    await Promise.all(
      (f.brokerage || []).map(async (b: BrokerageProperties) => {
        return Brokerage.assert(
          {
            ...b,
            sensorId: f.sensorId || sensor.sensorId,
          },
          trx,
          ((instance && instance.brokerage) || []).find((fb: Brokerage) =>
            fb.isEquivalent(b)
          )
        )
      })
    )
    await Promise.all(
      (f.timeseries || []).map(async (t: TimeseriesProperties) => {
        return Timeseries.assert(
          {
            ...t,
            sensorId: f.sensorId || sensor.sensorId,
          },
          trx,
          ((instance && instance.timeseries) || []).find((ft: Timeseries) =>
            ft.isEquivalent(t)
          )
        )
      })
    )

    return sensor.sensorId || instance
  }

  public static async create(
    f: SensorProperties,
    trx?: Transaction
  ): Promise<any> {
    const sensor = await this.query(trx).insert(<any>{
      propertyId: f.propertyId,
      meta: f.meta,
      platformId: f.platformId,
    })
    return sensor
  }

  public static async getSensorFromBrokerage(criteria: {
    sourceId: string
    brokerName: string
  }): Promise<any> {
    const { brokerName, sourceId } = criteria

    return await transaction(this.knex(), async (trx) => {
      return await Sensor.namedQuery(
        `Get sensor from brokerage '${sourceId}' on broker '${brokerName}'`,
        trx
      )
        .limit(1)
        .where(
          'sensor_id',
          '=',
          Brokerage.query()
            .select('sensor_id')
            .where('source_id', '=', sourceId)
            .limit(1)
            .andWhere(
              'broker_id',
              '=',
              Broker.query()
                .select('broker_id')
                .where('name', '=', brokerName)
                .limit(1)
            )
        )
        .eager(`[ ${Sensor.defaultEager} ]`)
        .modifyEager('service', (builder: any) => {
          builder.orderBy('time', 'desc').limit(1)
        })
        .first()
    })
  }

  public static async getSensorFromTimeseries(
    timeseriesId: string
  ): Promise<any> {
    return await Sensor.namedQuery(
      `Get sensor from timeseries ID '${timeseriesId}'`
    )
      .limit(1)
      .where(
        'sensor_id',
        '=',
        Timeseries.query()
          .select('sensor_id')
          .where('timeseries_id', '=', timeseriesId)
          .limit(1)
      )
      .eager(`[ ${Sensor.defaultEager} ]`)
      .modifyEager('service', (builder: any) => {
        builder.orderBy('time', 'desc').limit(1)
      })
      .first()
  }

  public static async getByFriendlyNames(
    platformName: string,
    propertyId: string,
    trx?: Transaction
  ): Promise<Sensor> {
    const set = await this.namedQuery(
      `Get sensor with fuzzy platform '${platformName}' and observed property '${propertyId}'`,
      trx
    )
      .where('property_id', '~*', fuzzyName(propertyId))
      .andWhere(
        'platform_id',
        '=',
        Platform.query()
          .select('platform_id')
          .where('name', '~*', fuzzyName(platformName))
          .limit(1)
      )
      .eager(`[ ${Sensor.defaultEager} ]`)
      .modifyEager('service', (builder: any) => {
        builder.orderBy('time', 'desc').limit(1)
      })
    return Array.isArray(set) && set.length ? set[0] : undefined
  }

  public static async getById(
    sensorId: string,
    trx?: Transaction
  ): Promise<Sensor> {
    return await this.namedQuery(`Get sensor with the ID '${sensorId}'`, trx)
      .findOne({ sensor_id: sensorId })
      .eager(`[ ${Sensor.defaultEager} ]`)
      .modifyEager('service', (builder: any) => {
        builder.orderBy('time', 'desc').limit(1)
      })
  }

  public isEquivalent(o: SensorProperties) {
    let brokerageMatches = false

    if (super.isEquivalent(o)) {
      return true
    }

    if (o.brokerage) {
      o.brokerage.forEach((newBrokerage: BrokerageProperties) => {
        this.brokerage.forEach((existingBrokerage: Brokerage) => {
          if (
            existingBrokerage.sourceId === newBrokerage.sourceId &&
            existingBrokerage.brokerId === newBrokerage.brokerId
          ) {
            brokerageMatches = true
          }
        })
      })
    }

    return brokerageMatches
  }

  public static async getAllRestricted(): Promise<any> {
    return await transaction(this.knex(), async (trx) => {
      const providerIds = (
        await Provider.namedQuery(`Get providers with restrictions`, trx)
          .eager(`[
          licence
        ]`)
      )
        .filter((provider: any) => !(provider.licence.description || {}).open)
        .map((provider: any) => provider.providerId)
      return Sensor.namedQuery('Get sensors with provider restrictions', trx)
        .eager(
          `[
          brokerage.[
            ${Brokerage.defaultEager}
          ]
        ]`
        )
        .whereIn('provider_id', providerIds)
    })
  }

  /*
   * This needs to be substantially expanded in future, but is here
   * for some further developments.
   */
  public async isRestricted(
    parent: any = null,
    requestDetail: RequestDetail = {}
  ): Promise<boolean> {
    if (!this.provider || !this.provider.licence) return false

    const licenceDescription = this.provider.licence.description || {}

    // No licence or open licence means no restrictions
    if (
      licenceDescription.open === true ||
      licenceDescription.open === undefined
    )
      return false

    // Could be restricted, so need to check against API keys etc...
    // Allow passing null as parent, in which case we look up
    const parentPlatform =
      parent ||
      (await (await Platform.getById(this.platformId)).toFilteredJSON(
        null,
        'up',
        requestDetail
      ))
    const { apiKey } = requestDetail
    const sensorTest = {
      sensor: {
        ...this.toJSON(),
        parentPlatform,
      },
    }

    let pathMatched = null
    if (apiKey !== undefined) {
      log.verbose(`Checking restricted status using api key "${apiKey}"...`)
      // TODO: These need to be queried from the database in future
      const restrictKey = (Config.getValue('api_restrict_key') ||
        uuidv4()) as string
      const permittedPaths: { [key: string]: any } = {
        restrictKey: [
          `$..*.parentPlatform.meta[?(@ === '6.023' && @property === 'roomNumber')]^^^^`,
        ],
      }

      pathMatched = (permittedPaths[apiKey] || []).forEach((path: string) => {
        if (JSONPath({ path, json: sensorTest, wrap: false })) {
          pathMatched = path
        }
      })
    }

    if (pathMatched !== null) {
      log.verbose(`Access granted using path ${pathMatched}`)
      return false
    }

    // Default is restricted
    return true
  }

  public async toFilteredJSON(
    parent?: any,
    windDirection?: 'up' | 'down' | 'both',
    requestDetail: RequestDetail = {}
  ): Promise<any> {
    const parentPlatform =
      windDirection === 'up' || windDirection === 'both'
        ? await (await Platform.getById(this.platformId)).toFilteredJSON(
            null,
            'up',
            requestDetail
          )
        : undefined
    const json = {
      ...this.toJSON(),
      parentPlatform: parentPlatform || parent,
      isRestricted: await this.isRestricted(
        parentPlatform ||
          (await parent.toFilteredJSON(null, 'up', requestDetail)),
        requestDetail
      ),
    }
    return {
      ...json,
      timeseries:
        !windDirection || windDirection === 'down' || windDirection === 'both'
          ? await Promise.all(
              this.timeseries.map((t: Timeseries) =>
                t.toFilteredJSON(json, undefined, undefined, requestDetail)
              )
            )
          : undefined,
      brokerage: await Promise.all(
        this.brokerage.map((b: Brokerage) =>
          b.toFilteredJSON(this, requestDetail)
        )
      ),
      provider: this.provider
        ? await this.provider.toFilteredJSON(this, requestDetail)
        : null,
      platformId: undefined,
      providerId: undefined,
      technologyId: undefined,
      parentPlatform,
      links: generateLinks([
        {
          href: `/api/sensor/${this.sensorId}`,
          rel: 'self',
        },
        {
          href: `/api/sensor/${uriName([
            (parentPlatform || parent || {}).name,
            this.propertyId,
          ])}`,
          rel: 'self.friendly',
        },
      ]),
    }
  }
}
