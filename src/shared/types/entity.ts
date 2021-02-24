import {Model, ref, transaction, Transaction} from 'objection';

import {fuzzyName, uriName} from 'shared/controllers/formatters';
import {cache, cacheResource} from 'shared/drivers/cache';
import {RequestDetail, StorageBase, SQL} from 'shared/drivers/sql';
import {Pagination, PageHandler} from 'shared/services/pagination';
import {log} from 'shared/services/log';
import {generateLinks} from 'shared/services/hateoas';
import {parseSearchTerms} from 'shared/services/search';

import {Brokerage} from './brokerage';
import {Position, PositionProperties} from './position';
import {Feed, FeedProperties} from './feed';

export interface EntityProperties {
  entityId?: string;
  name: string;
  meta: any;
  position?: PositionProperties[];
  feed?: FeedProperties[];
}

@cacheResource({
  expiration: 300,
  uniqueId: 'entityId'
})
export class Entity extends StorageBase implements EntityProperties {
  static tableName: string = SQL.TableName('entity');
  static idColumn: string = 'entity_id';
  static defaultEager: string = `
    position.[
      spatial
    ],
    feed.[
      ${Feed.defaultEager}
    ]
  `;

  // Table attributes
  public entityId: string;
  public name: string;
  public meta: any;

  public position: Position[];
  public feed: Feed[];

  // Table relations
  static relationMappings = {
    position: {
      relation: Model.HasManyRelation,
      modelClass: Position,
      join: {
        from: `${SQL.TableName('entity')}.entity_id`,
        to: `${SQL.TableName('position')}.entity_id`
      }
    },
    feed: {
      relation: Model.HasManyRelation,
      modelClass: Feed,
      join: {
        from: `${SQL.TableName('entity')}.entity_id`,
        to: `${SQL.TableName('feed')}.entity_id`
      }
    }
  };

  public static async assert(e: EntityProperties, trx?: Transaction, instance?: Entity): Promise<any> {
    const entityId = e.entityId || (instance && instance.entityId);
    let entity: Entity;

    if (!entityId) {
      entity = await this.create(e, trx);
    }

    if (!instance && e.entityId) {
      instance = await Entity.getById(e.entityId, trx);
    }

    if (instance && instance.shouldPatch(e)) {
      await this.query(trx)
        .skipUndefined()
        .patch(<any>{...e})
        .where({
          entity_id: instance.entityId
        });
      entity = await Entity.getById(instance.entityId, trx);
    }

    await Promise.all((e.feed || []).map(async (f: FeedProperties) => {
      return Feed.assert(
        {
          ...f,
          entityId: e.entityId || entity.entityId
        },
        trx,
        (instance && instance.feed || []).find(
          (eb: Feed) => eb.isEquivalent(f)
        )
      );
    }));

    return entity || instance;
  }

  public static async create(e: EntityProperties, trx?: Transaction): Promise<any> {
    const entity = await this.query(trx)
      .insert(<any>{
        name: e.name,
        meta: e.meta
      });
    return entity;
  }

  public static async getByFriendlyName(entity: string, trx?: Transaction): Promise<Entity> {
    const set = await this.namedQuery(`Get entity with the loose name '${entity}'`, trx)
      .where('name', '~*', fuzzyName(entity))
      .eager(`[ ${Entity.defaultEager} ]`)
      .modifyEager('feed.[service]', builder => {
        builder.orderBy('time', 'desc').limit(1);
      });
    if (Array.isArray(set) && set.length > 1) log.verbose(`Fuzzy match failed, got ${set.length} results.`);
    return Array.isArray(set) && set.length <= 1 ? set[0] : undefined;
  }

  public static async getById(entityId: string, trx?: Transaction): Promise<Entity> {
    return await this.namedQuery(`Get entity with the ID '${entityId}'`, trx)
      .findOne({entity_id: entityId})
      .eager(`[ ${Entity.defaultEager} ]`)
      .modifyEager('feed.[service]', builder => {
        builder.orderBy('time', 'desc').limit(1);
      });
  }

  public static async getIdFromName(name: string, trx?: Transaction): Promise<Entity> {
    return await this.namedQuery(`Get entity ID only from name '${name}'`, trx)
      .select('entity_id')
      .findOne({name: name});
  }

  public static async getIndex(): Promise<any[]> {
    const allEntities = Entity.namedQuery('Get summary for all entities')
      .select('entity.entity_id', 'name')
      .alias('entity')
      .orderBy('name')
      .eagerAlgorithm(Entity.JoinEagerAlgorithm)
      .eager('[feed]')
      .modifyEager('[feed]', (builder: any) => {
        builder.select('feed_id', 'metric')
      });

    return allEntities;
  }

  public static async getAll(preload?: boolean): Promise<any[]> {
    const entityBatchSize = 50;
    const entitySet = [];
    let entityOffset = 0;

    while (entityOffset < 1000000) {
      log.verbose(`Loading entities starting at ${entityOffset}...`);
      const allEntities = await ((preload ?
        Entity.query() :
        Entity.namedQuery('Get all entities'))
        .orderBy('name')
        .offset(entityOffset)
        .limit(entityBatchSize)
        .eager(`[ ${this.defaultEager} ]`)
        .modifyEager('feed', builder => {
          builder.orderBy('metric');
        })
        .modifyEager('feed.[service]', builder => {
          builder.orderBy('time', 'desc').limit(1);
        }));

      if (preload && allEntities && allEntities.length) {
        allEntities.forEach((entity: Entity) => this.precacheQueries(entity));
      }

      if (!allEntities.length) {
        return entitySet;
      } else {
        entitySet.push.apply(entitySet, allEntities);
        entityOffset += entityBatchSize;
      }
    }

    return entitySet;
  }

  public static async getPaginated(pagination: Pagination, criteria: {[key: string]: string} = {}): Promise<any> {
    const paging = PageHandler.impose(pagination);
    const searchNames = parseSearchTerms(criteria['name'] || '') || [];
    const searchMetrics = parseSearchTerms(criteria['metric'] || '') || [];

    if (searchMetrics.length) {
      log.verbose(`Name criteria:`);
      searchNames.forEach((m: string) => log.verbose(`  ${m}`));
    }

    if (searchMetrics.length) {
      log.verbose(`Metric criteria:`);
      searchMetrics.forEach((m: string) => log.verbose(`  ${m}`));
    }

    return Entity.namedQuery(`Get entities on page ${paging[0]} size ${paging[1]} criteria ${JSON.stringify(criteria || {})}`)
      .orderBy('name')
      .eager(`[ ${this.defaultEager} ]`)
      .modifyEager('feed.[service]', builder => builder.orderBy('time', 'desc').limit(1))
      .modifyEager('feed.[brokerage]', builder => builder.eagerAlgorithm(Model.JoinEagerAlgorithm))
      .modifyEager('feed.[hardware]', builder => builder.eagerAlgorithm(Model.JoinEagerAlgorithm))
      .modifyEager('feed.[technology]', builder => builder.eagerAlgorithm(Model.JoinEagerAlgorithm))
      // Filtering options below...
      .modifyEager('feed', builder => {
        builder
          .orderBy('metric')
          .onBuild((builder: any) => {
            // Both entities and feeds must be filtered, if we have a source restriction
            if (criteria['brokerage:sourceId']) {
              builder.whereIn('feed_id', Brokerage
                .query()
                .select('feed_id')
                .where('source_id', '=', criteria['brokerage:sourceId'])
              );
            }

            if (searchMetrics.length) {
              builder.where((searchBuilder: any) =>
                searchMetrics.forEach((m: string) => searchBuilder.orWhere('metric', 'ILIKE', `%${m}%`))
              );
            }
          });
      })
      .onBuild((builder: any) => {
        // Allow for filtering on the entity's meta tags
        Object.keys(criteria || {}).forEach((key: string) => {
          if (key.indexOf('meta:') === 0) {
            builder.where(ref(key).castText(), criteria[key]);
          }
        });

        // Allow for filtering on the source ID at the broker or controller
        if (criteria['brokerage:sourceId']) {
          builder.whereIn('entity_id', Feed
            .query()
            .distinct(`${Feed.tableName}.entity_id`)
            .innerJoin(`${Brokerage.tableName}`, `${Feed.tableName}.feed_id`, `${Brokerage.tableName}.feed_id`)
            .where(`${Brokerage.tableName}.source_id`, '=', criteria['brokerage:sourceId'])
          );
        }

        if (searchMetrics.length) {
          builder.whereIn('entity_id', Feed
            .query()
            .distinct('entity_id')
            .onBuild((metricSearchBuilder: any) => {
              if (searchMetrics.length) {
                metricSearchBuilder.where((searchBuilder: any) =>
                  searchMetrics.forEach((m: string) => searchBuilder.orWhere('metric', 'ILIKE', `%${m}%`))
                );
              }
            })
          );
        }

        if (searchNames.length) {
          builder.where((searchBuilder: any) =>
            searchNames.forEach((m: string) => searchBuilder.orWhere('name', 'ILIKE', `%${m}%`))
          );
        }
      })
      .page(...paging)
      .then((result: any) => PageHandler.wrapOutput(pagination, result));
  }

  public static precacheQueries(entity: Entity) {
    cache.commit(`sql:Get entity with the ID '${entity.entityId}'`, entity);
    cache.commit(`sql:Get entity ID only from name '${entity.name}'`, {entityId: entity.entityId});
    entity.feed.forEach((feed: Feed) => {
      cache.commit(`sql:Get feed with the ID '${feed.feedId}'`, feed);
      feed.brokerage.forEach((brokerage: Brokerage) => {
        cache.commit(`receiver:${brokerage.sourceId} on ${brokerage.broker.name}`, true);
        cache.commit(`sql:Get brokerage for source ID '${brokerage.sourceId}' and broker '${brokerage.broker.name}'`, brokerage);
        cache.commit(`sql:Get feed from brokerage '${brokerage.sourceId}' on broker '${brokerage.broker.name}'`, feed);
      });
    });
  }

  public async toFilteredJSON(parent: any = undefined, windDirection: 'up' | 'down' = 'down', requestDetail: RequestDetail = {}): Promise<any> {
    return {
      ...this.toJSON(),
      feed: (!windDirection || windDirection === 'down') ?
        await Promise.all(this.feed.map((f: Feed) => f.toFilteredJSON(this, 'down', requestDetail))) :
        undefined,
      links: generateLinks([
        {
          href: `/sensors/entity/${this.entityId}`,
          rel: 'self'
        },
        {
          href: `/sensors/entity/${uriName(
            this.name
          )}`,
          rel: 'self.friendly'
        }
      ])
    };
  }
}
