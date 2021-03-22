const BACNET = require('bacstack')

export interface BACNETPropertyRequest {
  objectType: BACNETObjectTypes
  objectIdentifier: number
  propertyIdentifiers: BACNETPropertyIdentifier[]
}

export interface BACNETPropertyData {
  identifier: BACNETPropertyIdentifier
  tag: number
  value: any
  exists: boolean
}

export interface BACNETPropertyResponse {
  objectType: BACNETObjectTypes
  objectTypeName: string
  objectIdentifier: number
  objectExists: boolean
  properties: { [key: string]: BACNETPropertyData }
}

export enum BACNETObjectTypes {
  AnalogInput = 0,
  AnalogOutput = 1,
  AnalogValue = 2,
  BinaryInput = 3,
  BinaryOutput = 4,
  BinaryValue = 5,
  Calendar = 6,
  Command = 7,
  Device = 8,
  EventEnrollment = 9,
  File = 10,
  Group = 11,
  Loop = 12,
  MultiStateInput = 13,
  MultiStateOutput = 14,
  NotificationClass = 15,
  Program = 16,
  Schedule = 17,
  Averaging = 18,
  MultiStateValue = 19,
  TrendLog = 20,
  LifeSafetyPoint = 21,
  LifeSafetyZone = 22,
  Accumulator = 23,
  PulseConverter = 24,
  EventLog = 25,
  GlobalGroup = 26,
  TrendLogMultiple = 27,
  LoadControl = 28,
  StructuredView = 29,
  AccessDoor = 30,
  AccessCredential = 32,
  AccessPoint = 33,
  AccessRights = 34,
  AccessUser = 35,
  AccessZone = 36,
  CredentialDataInput = 37,
  NetworkSecurity = 38,
  BitstringValue = 39,
  CharacterStringValue = 40,
  DatePatternValue = 41,
  DataValue = 42,
  DataTimePatternValkue = 43,
  DateTimeValue = 44,
  IntegerValue = 45,
  LargeAnalogValue = 46,
  OctetString = 47,
  PositiveInteger = 48,
  TimePatternValue = 49,
  TimeValue = 50,
  NotificationForwarder = 51,
  AlertEnrollment = 52,
  Channel = 53,
  LightingOutput = 54,
}

export enum BACNETPropertyIdentifier {
  Name = 77,
  PresentValue = 85,
  ObjectType = 79,
  Description = 28,
  OutOfService = 81,
  Units = 117,
  DeviceType = 31,
  UpdateInterval = 118,
  Resolution = 106,
  StatusFlags = 111,
  EventState = 36,
}

export const BACNETTagIDToName: { [key: number]: string } = Object.keys(
  BACNET.enum.BacnetApplicationTags
).reduce((set, id) => {
  const tag = parseInt(BACNET.enum.BacnetApplicationTags[id], 10)
  set[tag] = id.replace('BACNET_APPLICATION_TAG_', '')
  return set
}, {} as { [key: number]: string })
