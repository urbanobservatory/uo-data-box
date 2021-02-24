import {transaction, Transaction} from 'objection';

import {cache} from 'shared/drivers/cache';
import {Config} from 'shared/services/config';
import {log} from 'shared/services/log';
import {MutexQueue} from 'shared/services/mutex-queue';
import {Brokerage, Entity, Feed, Timeseries} from 'shared/types';
import {Data} from 'shared/types/data';

import {IncomingStream} from './types';

const pendingFullUpdates: {[id: string]: boolean} = {};
const queueFullUpdates = new MutexQueue();

export class Receiver {
  public static async consume(stream: IncomingStream) {
    if (!stream.brokerage || !stream.brokerage.broker.id) {
      log.warn(`Received data without broker ID. Cannot process.`);
      log.debug(JSON.stringify(stream, null, 2));
      return;
    }
    if (!stream.brokerage.id) {
      log.warn(`Received data from ${stream.brokerage.broker.id} without brokerage ID. Cannot process.`);
      log.debug(JSON.stringify(stream, null, 2));
      return;
    }
    if (!stream.timeseries.value.type || stream.timeseries.value.type.toString().toLowerCase() === 'unknown') {
      log.warn(`Received data for ${stream.entity.name} without valid type. Cannot process.`);
      log.warn(`  Metric:    ${stream.feed.metric}`);
      log.warn(`  Brokerage: ${stream.brokerage.id}`);
      log.debug(JSON.stringify(stream, null, 2));
      return;
    }

    const fullUpdateFrequency = parseInt(Config.getValue('storage_full_update_frequency') || '300', 10);
    let lastUpdate = cache.fetch(
      `receiver:${stream.brokerage.id} on ${stream.brokerage.broker.id}`,
      fullUpdateFrequency
    );

    const pendingId = `${stream.brokerage.broker.id}:${stream.brokerage.id}`;
    if (!lastUpdate && !pendingFullUpdates[pendingId] && fullUpdateFrequency > 0) {
      log.verbose(`Full update due for ${stream.entity.name} ${stream.feed.metric} for ${stream.brokerage.broker.id}...`);
      pendingFullUpdates[pendingId] = true;
      queueFullUpdates.addQueue(() =>
        this
          .consumeFullUpdate(stream)
          .then(() => delete pendingFullUpdates[pendingId])
      );
    }

    const dataType = stream.timeseries.value.type;
    const DataHandler = Data[dataType];

    if (!DataHandler) {
      log.warn(`Received data without valid corresponding storage class. Cannot process.`);
      log.debug(JSON.stringify(stream, null, 2));
      return;
    }

    // Resolve brokerage data back to a feed ID if possible
    let feed = await Feed.getFeedFromBrokerage({
      brokerName: stream.brokerage.broker.id,
      sourceId: stream.brokerage.id
    });

    // Not sure why this might happen, but probably doesn't exist yet
    if (!feed) {
      // Don't bother waiting for this to complete, it's mutexed per item
      // by the pending array
      if (pendingFullUpdates[pendingId]) {
        return;
      }
      pendingFullUpdates[pendingId] = true;
      queueFullUpdates.addQueue(() => this.consumeFullUpdate(stream).then(() => {
        delete pendingFullUpdates[pendingId];
        log.verbose(`Rescheduling delayed data from '${stream.brokerage.broker.id}' after full update...`);
        setTimeout(() => this.consume(stream));
      }));
      log.info(`Creating ${stream.entity.name} ${stream.feed.metric} for ${stream.brokerage.broker.id}...`);
      return;
    } else {
      log.verbose(`Consuming ${stream.entity.name} ${stream.feed.metric} from ${stream.brokerage.broker.id}...`);
    }

    // Will need to actually be clever about how we select a timeseries once
    // derivatives and aggregation is thrown into the mix.
    const targetTimeseries = feed.timeseries.find(
      (timeseries: Timeseries) => true
    );

    // Don't insert undefined
    if (stream.timeseries.value.data === undefined) {
      log.warn('Encountered undefined value in data stream. Will not store.');
      return;
    }

    // Don't wait for the insert once it's in our memory system
    const insertState = await DataHandler.insertRecord({
      time: stream.timeseries.value.time,
      duration: -(stream.timeseries.value.timeAccuracy || 0),
      value: stream.timeseries.value.data,
      timeseries_num: targetTimeseries.timeseriesNum
    });
    if (insertState === false) {
      log.verbose('  [-] Stream data was rejected: queue at capacity limit.');
      return false;
    }

    // Will need to push this data back out for the real-time stream
    // Format to be decided...
    /*
    const updatedEntity = (await Entity.getById(feed.entityId)).toFilteredJSON();
    const updatedTS = updatedEntity
      .feed.find((entityFeed: Feed) => entityFeed.feedId === feed.feedId)
      .timeseries.find((entityTS: Timeseries) => entityTS.timeseriesId === targetTimeseries.timeseriesId);

    // Supplant our latest data :-)
    updatedTS.latest = {
      ...updatedTS,
      timeseries_num: undefined
    };
    //console.log(JSON.stringify(updatedEntity, null, 2));
    */
  }

  public static async consumeFullUpdate(stream: IncomingStream): Promise<Entity> {
    // Creating a transaction is a fairly slow process, so try to avoid
    // if possible...
    let entity = null;

    await transaction(Entity.knex(), async (trx: Transaction) => {
      // Resolve brokerage data back to a feed ID if possible
      const feedId = await Brokerage.getFeedIdFromBrokerage({
        brokerName: stream.brokerage.broker.id,
        sourceId: stream.brokerage.id
      });

      if (!feedId) {
        log.info(`Consuming previously unidentified feed on '${stream.entity.name}'.`);
        log.info(`  Metric:    ${stream.feed.metric}`);
        log.info(`  Brokerage: ${stream.brokerage.id}`);
      }

      // Entity names must be unique, so find out if it already exists
      const entityRecord = await Entity.getIdFromName(stream.entity.name, trx);

      /**
       * This will guarantee that an entity exists with the correct name,
       * either by creating one, or updating an existing set of records.
       */
      try {
        entity = await Entity.assert(
          {
            entityId: entityRecord && entityRecord.entityId,
            name: stream.entity.name,
            meta: stream.entity.meta,
            feed: [{
              feedId,
              metric: stream.feed.metric,
              meta: stream.feed.meta,
              brokerage: [{
                sourceId: stream.brokerage.id,
                meta: stream.brokerage.broker.meta,
                broker: {
                  name: stream.brokerage.broker.id
                }
              }],
              timeseries: [{
                unit: {
                  name: stream.timeseries.unit
                },
                storage: {
                  name: stream.timeseries.value.type
                }
              }]
            }]
          },
          trx,
          entityRecord && await Entity.getById(entityRecord.entityId, trx)
        );
      } catch (e) {
        if (e.message.indexOf('duplicate key') >= 0) {
          log.warn('Duplicate key encountered during full update. Will retry...');
          return new Promise((resolve: Function, reject: Function) => {
            setTimeout(() => {
              this.consumeFullUpdate(stream).then(() => resolve());
            }, 0);
          });
        } else {
          log.warn('An error occurred while consuming data for a full update.');
          log.warn(`  ${e.message}`);
          log.debug(`  ${e.stack}`);
        }
      }

      entity = await Entity.getById(entity.entityId, trx);
      await Entity.precacheQueries(entity);
    });

    if (entity) {
      cache.commit(`receiver:${stream.brokerage.id} on ${stream.brokerage.broker.id}`, true);
    }

    return entity;
  }
}
