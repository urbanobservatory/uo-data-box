import * as BACNET from 'bacstack';

import {log} from 'shared/services/log';
import {MutexQueue} from 'shared/services/mutex-queue';

import {BACNETPropertyRequest, BACNETPropertyResponse, BACNETPropertyData,
        BACNETPropertyIdentifier, BACNETObjectTypes} from './enums';
import {BACNETObject, BACNETObjectOptions} from './object';
import {Controller, ControllerOptions} from '../controller';

export interface BACNETControllerOptions extends ControllerOptions {
  discovery: BACNETDiscoveryOptions;
  updateInterval: number;
  updateBatchSize: number;
  getMetadata?: (objectData: any) => {[key: string]: any};
  getCOVPrecision?: (objectData: any) => number;
  isUpdateSignificant?: (oldValue: any, newValue: any) => boolean;
}

export interface BACNETDiscoveryOptions {
  objectIdStart: number;
  objectIdEnd: number;
  objectBatchSize: number;
  autoDiscovery: boolean;
  autoDiscoveryInterval: number;
}

export interface BACNETFileCacheEntry {
  identifier: number;
  type: number;
  properties: {[key: string]: BACNETPropertyData};
}

let bacnetConnection = null;
const bacnetSendQueue: MutexQueue = new MutexQueue();
const getConnection = () => bacnetConnection || (bacnetConnection = new BACNET({ adpuTimeout: 1000 }));

export class BACNETController extends Controller {
  protected classType: string = 'BACNET';
  protected options: BACNETControllerOptions;
  protected connection: BACNET;
  private objects: {[key: string]: any} = {};
  private sendQueue: MutexQueue = bacnetSendQueue; // Mutex across all controllers
  private discoveryOffset: number = 0;
  private discoveryTimer: any;
  private discoveryInProgress: boolean = false;
  private acquisitionTimer: any;
  private acquisitionInProgress: boolean = false;

  constructor (options: BACNETControllerOptions) {
    super();
    this.options = options;
    this.discoveryOffset = this.options.discovery.objectIdStart;
  }

  public getMetadata() {
    return {
      protocol: 'BACNET'
    };
  }

  public getOptions(): BACNETControllerOptions {
    return this.options;
  }

  public async connect(): Promise<any> {
    if (this.connection) {
      await this.disconnect();
    }

    // This will handle DNS resolution etc for us.
    await super.connect();

    log.verbose(`Attempting to connect to BACNET controller ${this.options.name}...`);
    return new Promise((resolve: Function, reject: Function) => {
      this.disconnecting = false;
      this.connected = true;
      this.connection = getConnection();
      return this.fileCache.readFile().then(() => {
        this.startDiscovery();
        this.startAcquisition();
        resolve();
      });
    }).catch((error: Error) => {
      log.error(`Error connecting to BACNET controller ${this.options.address}.`);
      log.error(`  ${error.message}`);
      log.debug(`  ${error.stack}`);
      this.disconnect();
    });
  }

  public async disconnect(): Promise<any> {
    if (!this.connected || !this.connection) {
      return Promise.resolve();
    }

    return new Promise((resolve: Function, reject: Function) => {
      this.endDiscovery();
      this.endAcquisition();
      this.disconnecting = true;
      log.info(`Disconnecting from BACNET controller ${this.options.name}...`);
      this.connection = null;
      resolve();
    });
  }

  public getObject(options: BACNETObjectOptions): BACNETObject {
    if (options.type === undefined || options.identifier === undefined) {
      throw new Error('Type and identifier required to resolve BACNET object.');
    }
    const persistenceKey = `${options.type}/${options.identifier}`;
    if (!this.objects[persistenceKey]) {
      this.objects[persistenceKey] = new BACNETObject({
        connection: this,
        ...options
      });
    }
    return this.objects[persistenceKey];
  }

  public async getProperties(props: BACNETPropertyRequest[] | BACNETPropertyRequest) {
    if (!this.connected || this.disconnecting) {
      return Promise.reject(new Error('Connection to BACNET controller has been closed.'));
    }

    const requestSet = (Array.isArray(props) ? props : [props]).map(
      (r: BACNETPropertyRequest) => ({
        objectIdentifier: {type: r.objectType, instance: r.objectIdentifier},
        propertyReferences: r.propertyIdentifiers.map(
          (p: BACNETPropertyIdentifier) => ({propertyIdentifier: p})
        )
      })
    );

    return this.sendQueue.addQueue((requeue: Function) => new Promise(
      (resolve: Function, reject: Function) => {
        let sendAttempts: number = 0;
        const sendRequest = () => {
          if (!this.connected || this.disconnecting) {
            return;
          }
          log.debug(`Sending BACNET request for data to ${this.options.name}...`);
          sendAttempts++;
          this.connection.readPropertyMultiple(
            this.options.ip,
            requestSet,
            (error: Error, value: any) => {
              if (error) {
                log.debug(`Received BACNET error ${error}.`);
                if (error.message.indexOf('ERR_TIMEOUT') >= 0) {
                  // Attempt to send again
                  if (sendAttempts < 5) {
                    log.warn(`Request to ${this.options.name} timed out. Will not retry automatically.`);
                    log.warn(`  First ID: Type ${requestSet[0].objectIdentifier.type} Instance: ${requestSet[0].objectIdentifier.instance}`);
                    log.warn(`  Last ID:  Type ${requestSet[requestSet.length - 1].objectIdentifier.type} Instance: ${requestSet[requestSet.length - 1].objectIdentifier.instance}`);
                    resolve(this.processProperties(null, requestSet));
                  } else {
                    log.error(`Requested to ${this.options.name} timed out 5 times. Will not retry.`);
                    resolve(this.processProperties(null, requestSet));
                  }
                  return;
                }
                resolve(this.processProperties(error, requestSet));
                return;
              }
              log.debug(`Received BACNET response from ${this.options.name}.`);
              resolve(this.processProperties(value, requestSet));
            }
          );
        };
        sendRequest();
      }
    ).catch((error: Error) => {
      log.error(`Error during property read on ${this.options.name}.`);
      log.error(`  ${error.message}`);
      log.debug(`  ${error.stack}`);
      this.discoveryInProgress = false;
    }));
  }

  /*
   *  The format of the data returned will vary, depending on whether a partial success or
   *  total failure occured. This function maps everything to a consistent format where
   *  each property is dealt with individually, provided the object existed.
   */
  private processProperties(response: any, requestSet: any): BACNETPropertyResponse[] {
    if (response === null || (response.message || '').indexOf('BacnetError') >= 0) {
      // The entire request was a failure. All of the objects do not exist.
      return requestSet.map((r: any) => ({
        objectType: r.objectIdentifier.type,
        objectTypeName: BACNETObjectTypes[r.objectIdentifier.type],
        objectInstance: r.objectIdentifier.instance,
        objectExists: false,
        properties: {}
      }));
    }

    // At least some of the properties were able to be queried successfully
    try {
      return requestSet.map((r: any): BACNETPropertyResponse => {
        if (!response.values) return;
        const responseObject = response.values.find(
          (ro: any) => ro.objectIdentifier.type === r.objectIdentifier.type &&
                      ro.objectIdentifier.instance === r.objectIdentifier.instance
        ) || {
          values: []
        };
        const responseObjectExists = !!responseObject.values.find((rv: any) => ((rv.value || {}).value || {}).errorCode !== 31 );
        return {
          objectType: r.objectIdentifier.type,
          objectTypeName: BACNETObjectTypes[r.objectIdentifier.type],
          objectIdentifier: r.objectIdentifier.instance,
          objectExists: !!responseObject.values.find((rv: any) => ((rv.value || {}).value || {}).errorCode !== 31 ),
          properties: responseObjectExists ?
            r.propertyReferences
              .map((p: any): BACNETPropertyData => {
                const responseValue = (responseObject.values.find((rv: any) => rv.propertyIdentifier === p.propertyIdentifier) || {}).value;
                const responseDetail = (Array.isArray(responseValue) ? responseValue.pop() : responseValue) || {};
                const responseExists = (responseDetail.value || {}).errorCode === undefined;
                return {
                  identifier: p.propertyIdentifier,
                  tag: responseDetail.type,
                  value: responseExists ? responseDetail.value : null,
                  exists: responseExists
                };
              })
              .reduce(
                (set: any, property: BACNETPropertyData) => {
                  set[BACNETPropertyIdentifier[property.identifier]] = property;
                  return set;
                },
                {}
              ) : {}
        };
      });
    } catch (e) {
      log.error('Could not process response from BACNET');
      log.error(`  ${e.message}`);
      log.debug(`  ${e.stack}`);
    }
  }

  protected startDiscovery() {
    if (this.discoveryInProgress || !this.connected || this.disconnecting) return;
    log.info(`Starting automatic discovery for ${this.options.name}...`);
    this.discoveryTimer = setInterval(() => this.discoverObjects(), 0);
  }

  protected endDiscovery() {
    if (!this.discoveryTimer) return;
    log.info(`Completed automatic discovery for ${this.options.name}.`);
    clearInterval(this.discoveryTimer);
    this.discoveryTimer = null;

    // Reschedule the next discovery to align with the interval specified
    const nextDiscovery = Math.ceil(
      Math.ceil(Date.now() / this.options.discovery.autoDiscoveryInterval) *
      this.options.discovery.autoDiscoveryInterval - Date.now()
    );
    log.verbose(`Next automatic discovery for ${this.options.name} will be in ${Math.ceil(nextDiscovery / 1000)} seconds.`);
    setTimeout(() => this.startDiscovery(), nextDiscovery);
  }

  protected startAcquisition() {
    if (!this.connected || this.disconnecting) return;
    log.info(`Starting automatic data acquisition for ${this.options.name}...`);
    this.acquisitionTimer = setInterval(() => this.updateValues(), this.options.updateInterval);
  }

  protected endAcquisition() {
    if (!this.acquisitionTimer) return;
    log.info(`Terminating data acquisition for ${this.options.name}.`);
    clearInterval(this.acquisitionTimer);
    this.acquisitionTimer = null;
  }

  private discoverObjects() {
    if (this.discoveryInProgress || !this.connected || this.disconnecting) return;
    this.discoveryInProgress = true;

    if (this.discoveryOffset >= this.options.discovery.objectIdEnd) {
      this.discoveryOffset = this.options.discovery.objectIdStart;
      this.discoveryInProgress = false;
      this.endDiscovery();
      return;
    }

    const startId = this.discoveryOffset;
    const endId = Math.min(startId + this.options.discovery.objectBatchSize, this.options.discovery.objectIdEnd);
    const groupSize = Math.min(endId - startId, this.options.discovery.objectBatchSize);

    log.debug(`Performing discovery on ${this.options.name} for object IDs ${startId} to ${endId}`);
    return this.getProperties(
      [].concat.apply([],
        Array.apply(null, {length: groupSize})
          .map(Number.call, Number)
          .map(
            (subId: number) => Object
              .keys(BACNETObjectTypes)
              .filter((k: any) => !Number.isNaN(Number(k)))
              .map(
                (objectType: any) => ({
                  objectType: Number(objectType),
                  objectIdentifier: startId + subId,
                  propertyIdentifiers: [
                    BACNETPropertyIdentifier.Name
                  ]
                })
              )
            )
          )
        ).then((returnData: BACNETPropertyResponse[]) => {
          const flatResponses = [].concat.apply([], returnData);
          if (!returnData || !returnData.length) return;
          const validObjects = flatResponses.filter(r => r && !!r.objectExists);
          if (validObjects && validObjects.length) {
            validObjects.forEach((o: BACNETPropertyResponse) => {
              if (o.objectType === undefined || o.objectIdentifier === undefined) return;
              const object = this.getObject({
                type: o.objectType,
                identifier: o.objectIdentifier,
                name: o.properties.Name.value,
                newlyDiscovered: true
              });
            });
          }
        }).then(() => {
          this.discoveryOffset = startId + groupSize;
          this.discoveryInProgress = false;
        }).catch((error: Error) => {
          log.error(`Error during discovery on ${this.options.name}.`);
          log.error(`  ${error.message}`);
          log.debug(`  ${error.stack}`);
          this.discoveryInProgress = false;
        });
  }

  private updateValues() {
    if (this.acquisitionInProgress || !this.connected || this.disconnecting) return;
    this.acquisitionInProgress = true;

    const knownObjects = Object.values(this.objects);
    const maximumRequestSize = this.options.updateBatchSize;
    const requestSet: Promise<any>[] = [];

    log.debug(`Requesting full update of present values for ${this.options.name}.`);
    for (let objectBase = 0; objectBase < knownObjects.length; objectBase += maximumRequestSize) {
      const requestObjects = knownObjects.slice(objectBase, objectBase + maximumRequestSize);
      const requestProperties: BACNETPropertyRequest[] = requestObjects.map(
        (o: BACNETObject) => ({
          objectType: o.getObjectType(),
          objectIdentifier: o.getObjectIdentifier(),
          propertyIdentifiers: [BACNETPropertyIdentifier.PresentValue]
        })
      );
      log.debug(`Submitting request to ${this.options.name} for ${requestProperties.length} present values.`);
      requestSet.push(
        this.getProperties(requestProperties).then(
          (objectData: BACNETPropertyResponse[]) => {
            [].concat.apply([], objectData).forEach((or: BACNETPropertyResponse) => {
              if (!or || (or.objectType === undefined || or.objectIdentifier === undefined)) return;
              const oc: BACNETObject = this.getObject({
                type: or.objectType,
                identifier: or.objectIdentifier
              });
              oc.consumePropertyData(or);
            })
        }).catch((error: Error) => {
          log.error(`Error during value update on ${this.options.name}.`);
          log.error(`  ${error.message}`);
          log.debug(`  ${error.stack}`);
        })
      );
    }

    Promise.all(requestSet).then(() => {
      this.acquisitionInProgress = false;
    })
  }

  public saveToCache(): BACNETFileCacheEntry[] {
    return Object.values(this.objects).map((o: BACNETObject) => ({
      identifier: o.getObjectIdentifier(),
      type: o.getObjectType(),
      properties: o.getProperties()
    }));
  }

  public loadFromCache(data: BACNETFileCacheEntry[]) {
    (data || []).forEach((c: BACNETFileCacheEntry) => {
      const o = this.getObject(c);
      o.consumePropertyData({
        objectType: c.type,
        objectIdentifier: c.identifier,
        objectTypeName: BACNETObjectTypes[c.type],
        objectExists: true,
        properties: c.properties
      });
    });
  }
}
