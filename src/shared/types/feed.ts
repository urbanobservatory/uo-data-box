import { Model, Transaction, transaction } from 'objection'
import { JSONPath } from 'jsonpath-plus'
import { v4 as uuidv4 } from 'uuid'

import { fuzzyName, uriName } from 'shared/controllers/formatters'
import { generateLinks } from 'shared/services/hateoas'
import { log } from 'shared/services/log'
import { cacheResource, CacheOptions } from 'shared/drivers/cache'
import { RequestDetail, StorageBase, SQL } from 'shared/drivers/sql'

import { Entity } from './'
import { Broker } from './broker'
import { Brokerage, BrokerageProperties } from './brokerage'
import { Hardware } from './hardware'
import { Provider } from './provider'
import { Service } from './service'
import { Technology } from './technology'
import { Timeseries, TimeseriesProperties } from './timeseries'
import { Config } from 'shared/services/config'

export interface FeedProperties {
  feedId?: string
  metric: string
  meta: any
  entityId?: string
  providerId?: string
  hardwareId?: string
  technologyId?: string
  provider?: Provider
  hardware?: Hardware
  technology?: Technology
  brokerage?: BrokerageProperties[]
  timeseries?: TimeseriesProperties[]
}

@cacheResource({
  expiration: 300,
  uniqueId: 'feedId',
})
export class Feed extends StorageBase implements FeedProperties {
  static tableName: string = SQL.TableName('feed')
  static idColumn: string = 'feed_id'
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
  public feedId!: string
  public metric!: string
  public meta!: any
  public entityId!: string
  public providerId!: string
  public hardwareId!: string
  public technologyId!: string
  public provider!: Provider
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
        from: `${SQL.TableName('brokerage')}.feed_id`,
        to: `${SQL.TableName('feed')}.feed_id`,
      },
    },
    provider: {
      relation: Model.HasOneRelation,
      modelClass: Provider,
      join: {
        from: `${SQL.TableName('feed')}.provider_id`,
        to: `${SQL.TableName('provider')}.provider_id`,
      },
    },
    hardware: {
      relation: Model.HasOneRelation,
      modelClass: Hardware,
      join: {
        from: `${SQL.TableName('feed')}.hardware_id`,
        to: `${SQL.TableName('hardware')}.hardware_id`,
      },
    },
    technology: {
      relation: Model.HasOneRelation,
      modelClass: Technology,
      join: {
        from: `${SQL.TableName('feed')}.technology_id`,
        to: `${SQL.TableName('technology')}.technology_id`,
      },
    },
    service: {
      relation: Model.HasManyRelation,
      modelClass: Service,
      join: {
        from: `${SQL.TableName('service')}.feed_id`,
        to: `${SQL.TableName('feed')}.feed_id`,
      },
    },
    timeseries: {
      relation: Model.HasManyRelation,
      modelClass: Timeseries,
      join: {
        from: `${SQL.TableName('timeseries')}.feed_id`,
        to: `${SQL.TableName('feed')}.feed_id`,
      },
    },
  }

  public static async assert(
    f: FeedProperties,
    trx?: Transaction,
    instance?: Feed
  ): Promise<any> {
    const feedId = f.feedId || (instance && instance.feedId)
    let feed: Feed = new Feed()

    if (!feedId) {
      feed = await this.create(f, trx)
    }

    if (!instance && f.feedId) {
      instance = await Feed.getById(f.feedId, trx)
    }

    if (instance && instance.shouldPatch(f)) {
      await this.query(trx)
        .skipUndefined()
        .patch(<any>{ ...f })
        .where({
          feed_id: instance.feedId,
        })
      feed = await Feed.getById(instance.feedId, trx)
    }

    await Promise.all(
      (f.brokerage || []).map(async (b: BrokerageProperties) => {
        return Brokerage.assert(
          {
            ...b,
            feedId: f.feedId || feed.feedId,
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
            feedId: f.feedId || feed.feedId,
          },
          trx,
          ((instance && instance.timeseries) || []).find((ft: Timeseries) =>
            ft.isEquivalent(t)
          )
        )
      })
    )

    return feed.feedId || instance
  }

  public static async create(
    f: FeedProperties,
    trx?: Transaction
  ): Promise<any> {
    const feed = await this.query(trx).insert(<any>{
      metric: f.metric,
      meta: f.meta,
      entityId: f.entityId,
    })
    return feed
  }

  public static async getFeedFromBrokerage(criteria: {
    sourceId: string
    brokerName: string
  }): Promise<any> {
    const { brokerName, sourceId } = criteria

    return await transaction(this.knex(), async (trx) => {
      return await Feed.namedQuery(
        `Get feed from brokerage '${sourceId}' on broker '${brokerName}'`,
        trx
      )
        .limit(1)
        .where(
          'feed_id',
          '=',
          Brokerage.query()
            .select('feed_id')
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
        .eager(`[ ${Feed.defaultEager} ]`)
        .modifyEager('service', (builder: any) => {
          builder.orderBy('time', 'desc').limit(1)
        })
        .first()
    })
  }

  public static async getFeedFromTimeseries(
    timeseriesId: string
  ): Promise<any> {
    return await Feed.namedQuery(
      `Get feed from timeseries ID '${timeseriesId}'`
    )
      .limit(1)
      .where(
        'feed_id',
        '=',
        Timeseries.query()
          .select('feed_id')
          .where('timeseries_id', '=', timeseriesId)
          .limit(1)
      )
      .eager(`[ ${Feed.defaultEager} ]`)
      .modifyEager('service', (builder: any) => {
        builder.orderBy('time', 'desc').limit(1)
      })
      .first()
  }

  public static async getByFriendlyNames(
    entityName: string,
    metric: string,
    trx?: Transaction
  ): Promise<Feed> {
    const set = await this.namedQuery(
      `Get feed with fuzzy entity '${entityName}' and metric '${metric}'`,
      trx
    )
      .where('metric', '~*', fuzzyName(metric))
      .andWhere(
        'entity_id',
        '=',
        Entity.query()
          .select('entity_id')
          .where('name', '~*', fuzzyName(entityName))
          .limit(1)
      )
      .eager(`[ ${Feed.defaultEager} ]`)
      .modifyEager('service', (builder: any) => {
        builder.orderBy('time', 'desc').limit(1)
      })
    return Array.isArray(set) && set.length ? set[0] : undefined
  }

  public static async getById(
    feedId: string,
    trx?: Transaction
  ): Promise<Feed> {
    return await this.namedQuery(`Get feed with the ID '${feedId}'`, trx)
      .findOne({ feed_id: feedId })
      .eager(`[ ${Feed.defaultEager} ]`)
      .modifyEager('service', (builder: any) => {
        builder.orderBy('time', 'desc').limit(1)
      })
  }

  public isEquivalent(o: FeedProperties) {
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
      return Feed.namedQuery('Get feeds with provider restrictions', trx)
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
    const parentEntity =
      parent ||
      (await (await Entity.getById(this.entityId)).toFilteredJSON(
        null,
        'up',
        requestDetail
      ))
    const { apiKey } = requestDetail
    const feedTest = {
      feed: {
        ...this.toJSON(),
        parentEntity,
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
          `$..*.parentEntity.meta[?(@ === '6.023' && @property === 'roomNumber')]^^^^`,
        ],
      }

      pathMatched = (permittedPaths[apiKey] || []).forEach((path: string) => {
        if (JSONPath({ path, json: feedTest, wrap: false })) {
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
    const parentEntity =
      windDirection === 'up' || windDirection === 'both'
        ? await (await Entity.getById(this.entityId)).toFilteredJSON(
            null,
            'up',
            requestDetail
          )
        : undefined
    const json = {
      ...this.toJSON(),
      parentEntity: parentEntity || parent,
      isRestricted: await this.isRestricted(
        parentEntity ||
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
      entityId: undefined,
      providerId: undefined,
      technologyId: undefined,
      parentEntity,
      links: generateLinks([
        {
          href: `/sensors/feed/${this.feedId}`,
          rel: 'self',
        },
        {
          href: `/sensors/feed/${uriName([
            (parentEntity || parent || {}).name,
            this.metric,
          ])}`,
          rel: 'self.friendly',
        },
      ]),
    }
  }
}
