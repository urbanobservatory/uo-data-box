import { Config } from 'shared/services/config'
import { events } from 'shared/services/events'
import { log } from 'shared/services/log'

import { BACNETController } from './controller'
import {
  BACNETObjectTypes,
  BACNETPropertyData,
  BACNETPropertyIdentifier,
  BACNETPropertyResponse,
  BACNETTagIDToName,
} from './enums'
import { Datapoint } from '../datapoint'
import { Data } from 'shared/types/data'

export interface BACNETObjectOptions {
  connection?: BACNETController
  type: BACNETObjectTypes
  identifier: number
  name?: string
  newlyDiscovered?: boolean
}

export class BACNETObject extends Datapoint {
  private options: BACNETObjectOptions
  protected connection: any
  private properties: { [key: string]: BACNETPropertyData } = {}
  private previousSeen: Date = new Date(0)
  private lastSeen: Date = new Date(0)
  private lastUpdated: Date = new Date(0)

  constructor(options: BACNETObjectOptions) {
    super(options)
    this.options = options
    if (this.options.newlyDiscovered) {
      this.requestMetadata()
      this.options.newlyDiscovered = false
      this.previousSeen = new Date()
      this.lastSeen = new Date()
      events.emit('sensor:new:bacnet', {
        controller: this.connection,
        sensor: this,
      })
    }
  }

  public getDataEntry() {
    const entryMetadata = this.connection.getOptions().getMetadata({
      name: this.options.name || '',
      description: (this.properties['Description'] || { value: '' }).value,
      units: (this.properties['Units'] || { value: '' }).value,
      tag: BACNETTagIDToName[this.properties['PresentValue'].tag] || 'UNKNOWN',
    })
    return {
      brokerage: {
        broker: {
          id: this.connection.getName(),
          meta: {
            ...this.connection.getMetadata(),
            ...entryMetadata.broker,
          },
        },
        id: this.options.name,
        meta: entryMetadata.brokerage,
      },
      entity: {
        name: entryMetadata.entityName,
        meta: entryMetadata.entity,
      },
      feed: {
        metric: entryMetadata.metricName,
        meta: entryMetadata.metric,
      },
      timeseries: {
        unit: entryMetadata.unit,
        value: {
          time: this.lastUpdated,
          timeAccuracy:
            (this.lastSeen.getTime() - this.previousSeen.getTime()) / 1000,
          data: this.properties['PresentValue'].value,
          type: entryMetadata.targetType,
        },
      },
    }
  }

  public requestMetadata() {
    log.info(
      `Discovered BACNET ${BACNETObjectTypes[this.options.type]} '${
        this.options.name
      }' (ID: ${this.options.identifier}) on ${this.connection.getName()}.`
    )
    log.verbose(
      `Requesting additional metadata for BACNET object '${this.options.name}'...`
    )
    this.requestProperties([
      BACNETPropertyIdentifier.Name,
      BACNETPropertyIdentifier.Description,
      BACNETPropertyIdentifier.Units,
      BACNETPropertyIdentifier.PresentValue,
      BACNETPropertyIdentifier.OutOfService,
    ])
  }

  public requestProperties(properties: BACNETPropertyIdentifier[]) {
    this.connection
      .getProperties({
        objectIdentifier: this.options.identifier,
        objectType: this.options.type,
        propertyIdentifiers: properties,
      })
      .then((objectData: BACNETPropertyResponse) => {
        log.debug(
          `Received property response data for BACNET object '${this.options.name}'...`
        )
        this.consumePropertyData(objectData)
      })
      .catch((error: Error) => {
        log.error(
          `Error during property discovery on BACNET object ${this.options.name}.`
        )
        log.error(`  ${error.message}`)
        log.debug(`  ${error.stack}`)
      })
  }

  public consumePropertyData(objectData: BACNETPropertyResponse) {
    const minimumCOVInterval = parseInt(
      Config.getValue('minimum_cov_interval') || '10',
      10
    )

    // Deal with array responses as well as plain objects
    if (Array.isArray(objectData)) {
      objectData.forEach((o: BACNETPropertyResponse) => {
        this.consumePropertyData(o)
      })
      return
    }

    if (
      objectData.objectIdentifier !== this.options.identifier ||
      objectData.objectType !== this.options.type
    ) {
      return
    }

    const covPrecision =
      (this.connection.getOptions().getCOVPrecision &&
        this.connection.getOptions().getCOVPrecision({
          name: this.options.name || '',
          description: (this.properties['Description'] || { value: '' }).value,
          units: (this.properties['Units'] || { value: '' }).value,
        })) ||
      3

    const previousValue = this.properties['PresentValue']
      ? Number(this.properties['PresentValue'].value).toPrecision(covPrecision)
      : undefined
    const previousProperties = this.properties
    this.properties = {
      ...this.properties,
      ...objectData.properties,
    }
    const updatedValue = this.properties['PresentValue']
      ? Number(this.properties['PresentValue'].value).toPrecision(covPrecision)
      : undefined
    const objectDescription = this.properties['Description']
      ? this.properties['Description'].value
      : 'Unknown'

    // Ensure we have a name if available
    if (this.properties['Name']) {
      this.options.name = this.properties['Name'].value
      if (
        this.properties['Description'] &&
        updatedValue !== undefined &&
        previousValue === undefined
      ) {
        log.verbose(
          `BACNET '${this.options.name}' (${objectDescription}) has initial value ${updatedValue}.`
        )
        events.emit('sensor:value:bacnet', {
          controller: this.connection,
          sensor: this,
          newValue: updatedValue,
        })
        this.lastSeen = new Date()
      }
    }

    // Track changes
    this.previousSeen = this.lastSeen
    this.lastSeen = new Date()
    if (
      previousValue !== undefined &&
      previousValue !== updatedValue &&
      this.previousSeen
    ) {
      if (
        this.lastUpdated &&
        Date.now() - this.lastUpdated.getTime() < minimumCOVInterval * 1000
      ) {
        log.verbose(
          `Omitting change notification for '${this.options.name}' (${objectDescription}).`
        )
        this.properties = previousProperties
        return
      } else {
        log.verbose(
          `BACNET '${this.options.name}' (${objectDescription}) has changed from ${previousValue} to ${updatedValue}.`
        )
      }
      events.emit('sensor:cov:bacnet', {
        controller: this.connection,
        sensor: this,
        oldValue: previousValue,
        newValue: updatedValue,
      })
      this.lastUpdated = new Date()
      this.sendDataEntry()
    }
  }

  public getObjectType(): BACNETObjectTypes {
    return this.options.type
  }

  public getObjectIdentifier(): number {
    return this.options.identifier
  }

  public getProperties(): { [key: string]: BACNETPropertyData } {
    return this.properties
  }
}
