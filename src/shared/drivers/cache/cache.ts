import { log } from 'shared/services/log'
import { StorageBase } from 'shared/drivers/sql/base'
import { events } from 'shared/services'

interface CacheEntry {
  time: number
  data: any
  associations: StorageBase[]
}

export class CacheManager {
  private store: { [key: string]: CacheEntry } = {}
  private idAssociations: { [id: string]: string[] } = {}
  private purgeExpired: any = null
  private purgeInterval: number = 60.0

  constructor() {
    this.addEventListeners()
    this.addPurgeTimer()
  }

  private addEventListeners() {
    events.on('app:end:*', () => {
      if (this.purgeExpired) {
        clearTimeout(this.purgeExpired)
        this.purgeExpired = null
      }
    })
  }

  private addPurgeTimer() {
    const nextPurge = Math.ceil(
      Math.ceil((Date.now() / this.purgeInterval) * 1000) *
        this.purgeInterval *
        1000 -
        Date.now()
    )

    this.purgeExpired = setTimeout(() => this.autoPurge(), nextPurge)
  }

  private autoPurge() {
    log.verbose('Auto-purging old cache entries...')
    const expiry = Date.now() - 3600 * 1000
    Object.keys(this.store).forEach((key: string) => {
      if (this.store[key].time < expiry) {
        this.purge(key)
      }
    })
  }

  public commit(key: string, data: any) {
    log.silly(`Storing new cache entry for '${key}'.`)
    this.store[key] = {
      time: Date.now(),
      data,
      associations: [],
    }
    this.recursivelyAssociate(key, data)
  }

  public fetch(key: string, expiration: number | undefined) {
    if (expiration === undefined) {
      log.silly(`Should never make it here. No record exists for '${key}'.`)
      return
    }
    if (this.store[key] === undefined) {
      log.silly(`No cache record exists for '${key}'.`)
      return
    }
    const e = this.store[key]
    if (e.time + expiration * 1000 < Date.now()) {
      delete this.store[key]
      return
    }
    log.silly(`Serving cached record for '${key}'.`)
    return this.store[key].data
  }

  public recursivelyAssociate(
    key: string,
    entity: StorageBase | StorageBase[],
    child: boolean = false
  ) {
    const entities = Array.isArray(entity) ? entity : [entity]
    entities.forEach((e: StorageBase) => {
      if (!child && e instanceof StorageBase) {
        this.associate(key, e)
      }
      Object.values(e).forEach((v: any) => {
        if (v instanceof StorageBase) {
          this.recursivelyAssociate(key, v, true)
        }
        if (Array.isArray(v) && v.length && v[0] instanceof StorageBase) {
          this.recursivelyAssociate(key, v, true)
        }
      })
    })
  }

  public associate(key: string, entity: StorageBase) {
    if (this.store[key] === undefined) {
      return
    }
    const associations = this.store[key].associations
    if (associations.indexOf(entity) < 0) {
      associations.push(entity)
    }
    const json = JSON.stringify(entity)
    const uuidSet = json.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
    )
    ;(uuidSet || []).forEach((uuid: string) => {
      if (!this.idAssociations[uuid]) {
        this.idAssociations[uuid] = []
      }
      if (this.idAssociations[uuid].indexOf(key) < 0) {
        this.idAssociations[uuid].push(key)
      }
    })
  }

  public purge(key: string) {
    delete this.store[key]
  }

  public purgeByAssociation(entity: StorageBase) {
    Object.keys(this.store).forEach((key: string) => {
      if (
        this.store[key] &&
        this.store[key].associations.indexOf(entity) >= 0
      ) {
        delete this.store[key]
      }
    })
  }

  public purgeByUUID(uuid: string) {
    if (!this.idAssociations[uuid]) return
    this.idAssociations[uuid].forEach((key: string) => {
      this.purge(key)
    })
    delete this.idAssociations[uuid]
  }
}

export const cache = new CacheManager()
