import { Model, ref, transaction, Transaction } from 'objection'

import { fuzzyName, uriName } from 'shared/controllers/formatters'
import { cache, cacheResource } from 'shared/drivers/cache'
import { RequestDetail, StorageBase, SQL } from 'shared/drivers/sql'
import { Pagination, PageHandler } from 'shared/services/pagination'
import { log } from 'shared/services/log'
import { generateLinks } from 'shared/services/hateoas'
import { parseSearchTerms } from 'shared/services/search'

import { Brokerage } from './brokerage'
import { Position, PositionProperties } from './position'
import { Sensor, SensorProperties } from './sensor'

export interface PlatformProperties {
  platformId?: string
  name: string
  meta: any
  position?: PositionProperties[]
  sensor?: SensorProperties[]
}

@cacheResource({
  expiration: 300,
  uniqueId: 'platformId',
})
export class Platform extends StorageBase implements PlatformProperties {
  static tableName: string = SQL.TableName('platform')
  static idColumn: string = 'platform_id'
  // FIXME: according to the uo-standards this should be a GeoJSON object
  // https://urbanobservatory.stoplight.io/docs/standards-namespace/models/location.json
  static defaultEager: string = `
    position.[
      spatial
    ],
    sensor.[
      ${Sensor.defaultEager}
    ]
  `

  // Table attributes
  public platformId!: string
  public name!: string
  public meta!: any

  public inDeployment!: string
  public position!: Position[]
  public sensor!: Sensor[]

  // Table relations
  static relationMappings = {
    position: {
      relation: Model.HasManyRelation,
      modelClass: Position,
      join: {
        from: `${SQL.TableName('platform')}.platform_id`,
        to: `${SQL.TableName('position')}.platform_id`,
      },
    },
    sensor: {
      relation: Model.HasManyRelation,
      modelClass: Sensor,
      join: {
        from: `${SQL.TableName('platform')}.platform_id`,
        to: `${SQL.TableName('sensor')}.platform_id`,
      },
    },
  }

  public static async assert(
    e: PlatformProperties,
    trx?: Transaction,
    instance?: Platform
  ): Promise<any> {
    const platformId = e.platformId || (instance && instance.platformId)
    let platform: any = null

    if (!platformId) {
      platform = await this.create(e, trx)
    }

    if (!instance && e.platformId) {
      instance = await Platform.getById(e.platformId, trx)
    }

    if (instance && instance.shouldPatch(e)) {
      await this.query(trx)
        .skipUndefined()
        .patch(<any>{ ...e })
        .where({
          platform_id: instance.platformId,
        })
      platform = await Platform.getById(instance.platformId, trx)
    }

    await Promise.all(
      (e.sensor || []).map(async (f: SensorProperties) => {
        return Sensor.assert(
          {
            ...f,
            platformId: e.platformId || platform.platformId,
          },
          trx,
          ((instance && instance.sensor) || []).find((eb: Sensor) =>
            eb.isEquivalent(f)
          )
        )
      })
    )

    return platform || instance
  }

  public static async create(
    e: PlatformProperties,
    trx?: Transaction
  ): Promise<any> {
    const platform = await this.query(trx).insert(<any>{
      name: e.name,
      meta: e.meta,
      inDeplyment: e.meta.inDeployment || null,
    })
    return platform
  }

  public static async getByFriendlyName(
    platform: string,
    trx?: Transaction
  ): Promise<Platform> {
    const set = await this.namedQuery(
      `Get platform with the loose name '${platform}'`,
      trx
    )
      .where('name', '~*', fuzzyName(platform))
      .eager(`[ ${Platform.defaultEager} ]`)
      .modifyEager('sensor.[service]', (builder: any) => {
        builder.orderBy('time', 'desc').limit(1)
      })
    if (Array.isArray(set) && set.length > 1)
      log.verbose(`Fuzzy match failed, got ${set.length} results.`)
    return Array.isArray(set) && set.length <= 1 ? set[0] : undefined
  }

  public static async getById(
    platformId: string,
    trx?: Transaction
  ): Promise<Platform> {
    return await this.namedQuery(
      `Get platform with the ID '${platformId}'`,
      trx
    )
      .findOne({ platform_id: platformId })
      .eager(`[ ${Platform.defaultEager} ]`)
      .modifyEager('sensor.[service]', (builder: any) => {
        builder.orderBy('time', 'desc').limit(1)
      })
  }

  public static async getIdFromName(
    name: string,
    trx?: Transaction
  ): Promise<Platform> {
    return await this.namedQuery(
      `Get platform ID only from name '${name}'`,
      trx
    )
      .select('platform_id')
      .findOne({ name: name })
  }

  public static async getIndex(): Promise<any[]> {
    const allEntities = Platform.namedQuery('Get summary for all entities')
      .select('platform.platform_id', 'name')
      .alias('platform')
      .orderBy('name')
      .eagerAlgorithm(Platform.JoinEagerAlgorithm)
      .eager('[sensor]')
      .modifyEager('[sensor]', (builder: any) => {
        builder.select('sensor_id', 'metric')
      })

    return allEntities
  }

  public static async getAll(preload?: boolean): Promise<any[]> {
    const platformBatchSize = 50
    const platformSet: any[] = []
    let platformOffset = 0

    while (platformOffset < 1000000) {
      log.verbose(`Loading entities starting at ${platformOffset}...`)
      const allEntities = await (preload
        ? Platform.query()
        : Platform.namedQuery('Get all entities')
      )
        .orderBy('name')
        .offset(platformOffset)
        .limit(platformBatchSize)
        .eager(`[ ${this.defaultEager} ]`)
        .modifyEager('sensor', (builder: any) => {
          builder.orderBy('metric')
        })
        .modifyEager('sensor.[service]', (builder: any) => {
          builder.orderBy('time', 'desc').limit(1)
        })

      if (preload && allEntities && allEntities.length) {
        allEntities.forEach((platform: Platform) =>
          this.precacheQueries(platform)
        )
      }

      if (!allEntities.length) {
        return platformSet
      } else {
        platformSet.push.apply(platformSet, allEntities)
        platformOffset += platformBatchSize
      }
    }

    return platformSet
  }

  public static async getPaginated(
    pagination: Pagination,
    criteria: { [key: string]: string } = {}
  ): Promise<any> {
    const paging = PageHandler.impose(pagination)
    const searchNames = parseSearchTerms(criteria['name'] || '') || []
    const searchMetrics = parseSearchTerms(criteria['metric'] || '') || []

    if (searchMetrics.length) {
      log.verbose(`Name criteria:`)
      searchNames.forEach((m: string) => log.verbose(`  ${m}`))
    }

    if (searchMetrics.length) {
      log.verbose(`Metric criteria:`)
      searchMetrics.forEach((m: string) => log.verbose(`  ${m}`))
    }

    return (
      Platform.namedQuery(
        `Get entities on page ${paging[0]} size ${
          paging[1]
        } criteria ${JSON.stringify(criteria || {})}`
      )
        .orderBy('name')
        .eager(`[ ${this.defaultEager} ]`)
        .modifyEager('sensor.[service]', (builder: any) =>
          builder.orderBy('time', 'desc').limit(1)
        )
        .modifyEager('sensor.[brokerage]', (builder: any) =>
          builder.eagerAlgorithm(Model.JoinEagerAlgorithm)
        )
        .modifyEager('sensor.[hardware]', (builder: any) =>
          builder.eagerAlgorithm(Model.JoinEagerAlgorithm)
        )
        .modifyEager('sensor.[technology]', (builder: any) =>
          builder.eagerAlgorithm(Model.JoinEagerAlgorithm)
        )
        // Filtering options below...
        .modifyEager('sensor', (builder: any) => {
          builder.orderBy('metric').onBuild((builder: any) => {
            // Both entities and sensors must be filtered, if we have a source restriction
            if (criteria['brokerage:sourceId']) {
              builder.whereIn(
                'sensor_id',
                Brokerage.query()
                  .select('sensor_id')
                  .where('source_id', '=', criteria['brokerage:sourceId'])
              )
            }

            if (searchMetrics.length) {
              builder.where((searchBuilder: any) =>
                searchMetrics.forEach((m: string) =>
                  searchBuilder.orWhere('metric', 'ILIKE', `%${m}%`)
                )
              )
            }
          })
        })
        .onBuild((builder: any) => {
          // Allow for filtering on the platform's meta tags
          Object.keys(criteria || {}).forEach((key: string) => {
            if (key.indexOf('meta:') === 0) {
              builder.where(ref(key).castText(), criteria[key])
            }
          })

          // Allow for filtering on the source ID at the broker or controller
          if (criteria['brokerage:sourceId']) {
            builder.whereIn(
              'platform_id',
              Sensor.query()
                .distinct(`${Sensor.tableName}.platform_id`)
                .innerJoin(
                  `${Brokerage.tableName}`,
                  `${Sensor.tableName}.sensor_id`,
                  `${Brokerage.tableName}.sensor_id`
                )
                .where(
                  `${Brokerage.tableName}.source_id`,
                  '=',
                  criteria['brokerage:sourceId']
                )
            )
          }

          if (searchMetrics.length) {
            builder.whereIn(
              'platform_id',
              Sensor.query()
                .distinct('platform_id')
                .onBuild((metricSearchBuilder: any) => {
                  if (searchMetrics.length) {
                    metricSearchBuilder.where((searchBuilder: any) =>
                      searchMetrics.forEach((m: string) =>
                        searchBuilder.orWhere('metric', 'ILIKE', `%${m}%`)
                      )
                    )
                  }
                })
            )
          }

          if (searchNames.length) {
            builder.where((searchBuilder: any) =>
              searchNames.forEach((m: string) =>
                searchBuilder.orWhere('name', 'ILIKE', `%${m}%`)
              )
            )
          }
        })
        .page(...paging)
        .then((result: any) => PageHandler.wrapOutput(pagination, result))
    )
  }

  public static precacheQueries(platform: Platform) {
    cache.commit(
      `sql:Get platform with the ID '${platform.platformId}'`,
      platform
    )
    cache.commit(`sql:Get platform ID only from name '${platform.name}'`, {
      platformId: platform.platformId,
    })
    platform.sensor.forEach((sensor: Sensor) => {
      cache.commit(`sql:Get sensor with the ID '${sensor.sensorId}'`, sensor)
      sensor.brokerage.forEach((brokerage: Brokerage) => {
        cache.commit(
          `receiver:${brokerage.sourceId} on ${brokerage.broker.name}`,
          true
        )
        cache.commit(
          `sql:Get brokerage for source ID '${brokerage.sourceId}' and broker '${brokerage.broker.name}'`,
          brokerage
        )
        cache.commit(
          `sql:Get sensor from brokerage '${brokerage.sourceId}' on broker '${brokerage.broker.name}'`,
          sensor
        )
      })
    })
  }

  public async toFilteredJSON(
    parent: any = undefined,
    windDirection: 'up' | 'down' = 'down',
    requestDetail: RequestDetail = {}
  ): Promise<any> {
    return {
      ...this.toJSON(),
      sensor:
        !windDirection || windDirection === 'down'
          ? await Promise.all(
              this.sensor.map((f: Sensor) =>
                f.toFilteredJSON(this, 'down', requestDetail)
              )
            )
          : undefined,
      links: generateLinks([
        {
          href: `/api/platform/${this.platformId}`,
          rel: 'self',
        },
        {
          href: `/api/platform/${uriName(this.name)}`,
          rel: 'self.friendly',
        },
      ]),
    }
  }
}
