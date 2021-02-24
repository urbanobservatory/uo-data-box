import {StorageBase} from 'shared/drivers/sql';

export interface CacheOptions {
  expiration?: number;
  tableName?: string;
  uniqueId: string;
}

export function cacheResource(definition: CacheOptions): any {
  return function(instance: typeof StorageBase) {
    Object.defineProperty(
      instance,
      'cacheOptions',
      {
        enumerable: true,
        value: {
          tableName: instance.tableName,
          ...definition
        }
      }
    );
  }
}
