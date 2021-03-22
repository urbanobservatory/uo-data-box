import { transaction, Transaction } from 'objection'
import * as knex from 'knex'

import { cache } from 'shared/drivers/cache'
import { StorageBase, SQL } from 'shared/drivers/sql'
import { Config } from 'shared/services/config'
import { events } from 'shared/services/events'
import { log } from 'shared/services/log'
import { Timeseries, Sensor } from 'shared/types'

export interface DataProperties {
  time: Date
  timeseries_num?: number
  duration?: number
  value?: any
}

export interface DataHistoric {
  startTime: Date
  endTime: Date
  limited: boolean
  values: DataProperties[]
}

export class Data extends StorageBase {
  static tableName: string = SQL.TableName('data')
  static idColumn: string[] = ['time', 'timeseries_num']
  static lastFullUpdate: Date | null = null

  // Table attributes
  public time!: Date
  public timeseries_num!: number
  public duration?: number
  public value?: any

  public static insertBuffer: DataProperties[] = []
  public static insertTimer: any = null
  public static insertInProgress: boolean = false

  public static async insertRecord(recordData: any) {
    if (!this.insertTimer) {
      this.insertTimer = setInterval(async () => {
        await this.flushRecords(false)
      }, parseInt(Config.getValue('storage_transaction_frequency') || '750', 10))
      this.addEventListeners()
    }
    if (this.insertBuffer.length > 100) return false
    this.insertBuffer.push(recordData)
    return true
  }

  public static async bulkInsertRecords(recordData: any[]) {
    this.insertBuffer.push(...recordData)
    await this.flushRecords(false, true)
  }

  protected static addEventListeners() {
    events.on('app:end:*', async () => {
      if (!this.insertTimer || !this.insertBuffer.length) return
      clearInterval(this.insertTimer)
      this.insertTimer = null
      log.info(
        `Received app termination notification. Should flush buffer for '${this.tableName}'...`
      )
      await this.flushRecords(false)
      log.info(`Completed flushing buffers for '${this.tableName}'.`)
    })
  }

  public static async flushRecords(
    singular: boolean,
    asyncCommit: boolean = false
  ) {
    let requireSingular = false

    if (!this.insertBuffer.length || this.insertInProgress) return
    this.insertInProgress = true

    const flushData = this.insertBuffer.slice()
    this.insertBuffer = []

    if (flushData.length > 0) {
      log.warn(
        `${flushData.length} records are required to be committed from ${this.tableName}.`
      )
    }

    if (singular) {
      log.verbose(
        `Falling back to ${flushData.length} singular inserts to ${this.tableName}.`
      )
      for (const insert of flushData) {
        if (
          insert.value === undefined ||
          !insert.time ||
          insert.duration === undefined ||
          !insert.timeseries_num
        ) {
          log.warn('Unable to insert because some data was missing.')
          continue
        }

        // Deal with non-primitives by encoding as JSON
        if (
          insert.value !== null &&
          insert.value !== undefined &&
          insert.value === Object(insert.value)
        ) {
          insert.value = JSON.stringify(insert.value)
        }

        try {
          await transaction(this.knex(), async (trx) => {
            try {
              await trx.schema.raw(
                `INSERT INTO "${this.tableName}" ("duration", "time", "timeseries_num", "value") VALUES (${insert.duration}, '${insert.time}', ${insert.timeseries_num}, '${insert.value}')`
              )
            } catch (e) {
              // Ignore unique constraint errors and transaction aborted errors
              if (!e.routine || e.routine.indexOf('unique') < 0) {
                log.warn('Error occurred during timeseries insert.')
                log.warn(e.message)
                console.log('Stack: ', e.stack)
              }
            }
          })
        } catch (e) {
          log.warn('Error occurred during timeseries insert.')
          log.warn(e.message)
          console.log('Stack: ', e.stack)
        }
        log.verbose('  [+] Singular insert batch successful.')
      }
    } else {
      log.verbose('Attempting multiple inserts in a single transaction...')
      await transaction(this.knex(), async (trx) => {
        await trx.schema
          .raw(
            flushData
              .map((insert: DataProperties) =>
                trx.raw(
                  `INSERT INTO "${this.tableName}" ("duration", "time", "timeseries_num", "value") VALUES (?, ?, ?, ?);`,
                  [
                    insert.duration,
                    insert.time,
                    insert.timeseries_num,
                    Object(insert.value) === insert.value
                      ? JSON.stringify(insert.value)
                      : insert.value,
                  ]
                )
              )
              .join(' ')
          )
          .catch((e: any) => {
            // Ignore unique constraint errors
            if (
              (!e.routine || e.routine.indexOf('unique') < 0) &&
              e.message.indexOf('transaction is aborted') <= 0
            ) {
              log.warn('Error occurred during timeseries insert.')
              log.warn(e.message)
              log.debug(e.stack)
            }
            log.verbose('Singular inserts required: ' + e.message)
            requireSingular = true
          })
        log.verbose('  [++] Transaction group insert batch successful.')
      })
    }

    // If some of the transaction failed, then try again with each record
    // individually.
    this.insertInProgress = false
    log.verbose(
      `Insert batch complete. ${this.insertBuffer.length} records remain buffered.`
    )
    if (requireSingular) {
      log.verbose(
        'Errors were encountered during bulk insert, will retry as singular.'
      )
      this.insertBuffer.push.apply(this.insertBuffer, flushData)
      await this.flushRecords(true)
    }
  }

  public static getMostRecent(timeseriesId: string) {
    // TODO: Review how old values should be served
    return cache.fetch(
      `Get most recent data for '${timeseriesId}'`,
      3600 * 24 * 7
    )
  }

  public static async getHistoric(
    timeseriesNum: number,
    startTime: Date,
    endTime: Date
  ): Promise<DataHistoric> {
    // TODO: Allow the limit to be customised
    log.verbose(
      `Requesting historic timeseries '${timeseriesNum}' from '${startTime.toISOString()}' to '${endTime.toISOString()}'`
    )

    let historicData = []
    try {
      historicData = await (this.query() as any)
        .select()
        .where('timeseries_num', '=', timeseriesNum)
        .where('time', '>=', startTime.toISOString())
        .where('time', '<=', endTime.toISOString())
        .orderBy('time', 'DESC')
        .limit(1000000)
        .timeout(40000, { cancel: true })
    } catch (e) {
      log.verbose('Unable to satisfy historic request.')
      log.verbose(e)
      throw e
    }

    return {
      startTime,
      endTime,
      limited: historicData.length >= 10000000,
      values: historicData.map((historic: any) => {
        const cleanOutput = { ...historic.toOutput() }
        delete cleanOutput.timeseriesNum
        delete cleanOutput.timeseries_num
        return cleanOutput
      }),
    }
  }

  public static async queryAllMostRecent() {
    log.verbose(`Updating cache of recent values for ${this.tableName}...`)

    const tsQuery: Date = new Date(Date.now() - 300 * 1000)
    const tsSince: Date =
      this.lastFullUpdate || new Date(Date.now() - 2 * 24 * 3600 * 1000)
    const tsMax: Date = new Date(Date.now() + 2 * 24 * 3600 * 1000)
    const tsRecords = await Timeseries.query()
      .distinct(Timeseries.raw('ON (d.timeseries_num) d.*, t.timeseries_id'))
      .from(
        Timeseries.raw(`
          ${this.tableName} d
        INNER JOIN
          ${SQL.TableName('timeseries')} t
        ON
          d.timeseries_num = t.timeseries_num
        WHERE
          d.time >= '${tsSince.toISOString()}'
        AND
          d.time <= '${tsMax.toISOString()}'
        ORDER BY
          d.timeseries_num, d.time DESC;
      `)
      )
      .catch((e: Error) => {
        log.info(
          `Failed to update most recent values from '${this.tableName}'.`
        )
        log.info(`  ${e.message}`)
        log.debug(`  ${e.stack}`)
      })
    if (!tsRecords) return
    tsRecords.forEach((record: any) => {
      cache.commit(`Get most recent data for '${record.timeseriesId}'`, record)
    })

    log.verbose(`Completed update of cache for ${this.tableName}...`)
    this.lastFullUpdate = tsQuery
  }

  /**
   * Use this function to change the timeseries output, if you need to.
   * No async allowed (unlike toFilteredJSON), it'd just be too painfully slow.
   */
  public toOutput(): any {
    return {
      ...this.toJSON(),
    }
  }
}
