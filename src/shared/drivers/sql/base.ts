import * as deepEqual from "deep-equal";
import { camelCase, mapKeys, snakeCase } from "lodash";
import * as Knex from "knex";
import { Model, QueryBuilder, Transaction } from "objection";

import { Config } from "shared/services/config";
import { log } from "shared/services/log";
import { cache, CacheOptions } from "../cache";

interface NamedQueryOptions {
  invalidate?: boolean;
  expiration?: number;
}

export interface RequestDetail {
  apiKey?: string;
}

let knexDefault;
const uuidTest = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

export const initialiseSQL = () => {
  knexDefault = Knex({
    client: "pg",
    debug: false,
    connection: {
      host: Config.getValue("db_host"),
      port: parseInt(Config.getValue("db_port"), 10) || 5432,
      user: Config.getValue("db_user"),
      password: Config.getValue("db_pass"),
      database: Config.getValue("db_name"),
    },
    pool: { min: 5, max: 35 },
  });
  Model.knex(knexDefault);
  /*
  const times = {};
  let count = 0;
  knexDefault.on('query', (query) => {
      const uid = query.__knexQueryUid;
      times[uid] = {
        position: count,
        query,
        startTime: Date.now(),
        finished: false
      };
      count = count + 1;
    })
    .on('query-response', (response, query) => {
      const uid = query.__knexQueryUid;
      times[uid].endTime = Date.now();
      times[uid].finished = true;
      times[uid].duration = times[uid].endTime - times[uid].startTime;
      if (times[uid].duration > 500) {
        log.verbose(`[SQL QUERY] Slow query duration of ${times[uid].duration}ms`);
        log.verbose(`  ${query.sql.substr(0, 200)}...`);
      }
      delete times[uid];
    });
*/
};

export class StorageBase extends Model {
  "constructor": typeof StorageBase;
  static cacheOptions?: CacheOptions;

  constructor() {
    super();
  }

  public static namedQuery(
    name: string,
    trx?: Transaction,
    options?: NamedQueryOptions,
    parameters?: { [key: string]: string | boolean | number }
  ): any {
    const cacheParameters =
      parameters && Object.keys(parameters).length
        ? `:${JSON.stringify(parameters)}`
        : "";
    const cacheKey = `sql:${name}${cacheParameters}`;
    const cacheEntry = cache.fetch(
      cacheKey,
      (options || {}).expiration || this.cacheOptions.expiration
    );

    const q = this.query(trx);
    if (cacheEntry !== undefined && !(options || {}).invalidate) {
      q.resolve(cacheEntry);
      return q;
    }

    log.debug(`Running SQL query for '${name}'`);
    (<any>q.runAfter)(
      (models: any, queryBuilder: QueryBuilder<StorageBase>) => {
        // Don't cache negative results, as we'll probably be asserting or creating immediately after
        if (
          !this.cacheOptions ||
          !models ||
          (Array.isArray(models) && !models.length)
        )
          return models;
        cache.commit(cacheKey, models);
        return models;
      }
    );
    return q;
  }

  public $formatDatabaseJson(json): any {
    json = super.$formatDatabaseJson(json);
    return mapKeys(json, (value: string, key: string) => {
      return snakeCase(key);
    });
  }

  public $parseDatabaseJson(json): any {
    json = mapKeys(json, (value: string, key: string) => {
      return camelCase(key);
    });
    return super.$parseDatabaseJson(json);
  }

  public $afterGet() {
    // Nothing :-)
  }

  public $afterInsert(cxt: any) {
    cache.purgeByAssociation(this);
    this.getRowCacheIDs().forEach((column: string) => {
      if (this[column] && uuidTest.test(this[column])) {
        cache.purgeByUUID(this[column]);
      }
    });
  }

  public $afterUpdate(updateOptions: any, cxt: any) {
    cache.purgeByAssociation(this);
    this.getRowCacheIDs().forEach((column: string) => {
      if (this[column] && uuidTest.test(this[column])) {
        cache.purgeByUUID(this[column]);
      }
    });
  }

  public $afterDelete(cxt: any) {
    cache.purgeByAssociation(this);
    this.getRowCacheIDs().forEach((column: string) =>
      cache.purgeByUUID(this[column])
    );
  }

  public getRowCacheIDs(): string[] {
    const formattedColumns: string[] = [];
    const idColumns: string[] = Array.isArray(this.constructor.idColumn)
      ? this.constructor.idColumn
      : [this.constructor.idColumn];
    idColumns.forEach((column: string) => {
      formattedColumns.push(column);
      formattedColumns.push(camelCase(column));
      formattedColumns.push(snakeCase(column));
    });
    return formattedColumns.filter((column: string) => !!this[column]);
  }

  public shouldPatch(requirements: any) {
    // Need to enforce an order in the JSON for our comparisons
    const compareJSON = (o: any) =>
      JSON.stringify(
        Object.keys(o)
          .sort()
          .reduce((r, k) => ((r[k] = o[k]), r), {})
      );

    let requiresPatch: boolean = false;
    Object.keys(requirements).forEach((column: string) => {
      const isInstance = this[column] instanceof StorageBase;
      const isArrayOfInstances =
        Array.isArray(this[column]) &&
        this[column].every((i: any) => i instanceof StorageBase);

      // TODO: Do we need to consider arrays of these also?
      const isPlain = this.constructor.isPlain(this[column]);
      const isPrimitive =
        typeof this[column] === "string" ||
        typeof this[column] === "boolean" ||
        typeof this[column] === "number" ||
        typeof this[column] === "undefined" ||
        this[column] === null;

      if (!isInstance && !isArrayOfInstances && (isPlain || isPrimitive)) {
        // Don't mistakenly treat undefined as changes
        if (
          isPrimitive &&
          (this[column] === null || this[column] === undefined) &&
          requirements[column] === undefined
        ) {
          return;
        }
        if (isPrimitive && this[column] !== requirements[column]) {
          requiresPatch = true;
        } else if (!deepEqual(this[column], requirements[column] || {})) {
          requiresPatch = true;
        }
      }
    });
    return requiresPatch;
  }

  public static isPlain(obj: any) {
    if (typeof obj == "object" && obj !== null) {
      if (typeof Object.getPrototypeOf == "function") {
        const proto = Object.getPrototypeOf(obj);
        return proto === Object.prototype || proto === null;
      }

      return Object.prototype.toString.call(obj) == "[object Object]";
    }
    return false;
  }

  public isEquivalent(o: any) {
    let equivalent = true;
    const idSet = Array.isArray(this.constructor.idColumn)
      ? this.constructor.idColumn
      : [this.constructor.idColumn];
    const idColumns = idSet
      .concat(idSet.map((column: string) => camelCase(column)))
      .filter(
        (column: string) =>
          this[column] !== undefined || o[column] !== undefined
      );
    idColumns.forEach((id: string) => {
      if (this[id] === undefined) return;
      if (this[id] !== o[id]) {
        equivalent = false;
      }
    });
    return equivalent && idColumns.length > 0;
  }

  public getGetters(): string[] {
    let parentPrototype = this.constructor.prototype;
    return Object.getOwnPropertyNames(parentPrototype).filter((name) => {
      return (
        typeof Object.getOwnPropertyDescriptor(parentPrototype, name)["get"] ===
        "function"
      );
    });
  }

  public getSetters(): string[] {
    let parentPrototype = this.constructor.prototype;
    return Object.getOwnPropertyNames(parentPrototype).filter((name) => {
      return (
        typeof Object.getOwnPropertyDescriptor(parentPrototype, name)["set"] ===
        "function"
      );
    });
  }

  public async toFilteredJSON(parent?: any): Promise<any> {
    // Unless otherwise directed...
    return Promise.resolve(this.toJSON());
  }
}
