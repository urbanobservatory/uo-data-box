import { DataBoolean } from './boolean'
import { DataProperties } from './data'
import { DataInteger } from './integer'
import { DataEvent } from './event'
import { DataReal } from './real'
import { DataString } from './string'
import { DataTimestamp } from './timestamp'
import { DataFile } from './file'
import { DataJson } from './json'

const Data = {
  Boolean: DataBoolean,
  Integer: DataInteger,
  Event: DataEvent,
  Real: DataReal,
  String: DataString,
  Timestamp: DataTimestamp,
  File: DataFile,
  JSON: DataJson,
}

export {
  Data,
  DataBoolean,
  DataProperties,
  DataEvent,
  DataInteger,
  DataReal,
  DataString,
  DataTimestamp,
  DataFile,
  DataJson,
}
