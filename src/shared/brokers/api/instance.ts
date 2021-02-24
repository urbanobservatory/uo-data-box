import { Downloader } from "shared/services/downloader";
import { events } from "shared/services/events";
import { log } from "shared/services/log";

import { APIController } from "./controller";
import { Datapoint } from "../datapoint";

const fileDownloader = new Downloader();

export interface APIInstanceOptions {
  connection?: APIController;
  newlyDiscovered?: boolean;
  identifier?: string;
}

export class APIInstance extends Datapoint {
  protected connection: any;
  private options: APIInstanceOptions;
  private previousSeen: Date = null;
  private lastSeen: Date = null;
  private lastUpdated: Date = null;
  private instanceData: any = {};
  private downloadInProgress = false;

  private responseData: any = {};
  private staticData: any = {};
  private dynamicData: any = {};

  constructor(options: APIInstanceOptions) {
    super(options);
    this.options = options;
    if (this.options.newlyDiscovered) {
      this.options.newlyDiscovered = false;
      this.previousSeen = new Date();
      this.lastSeen = new Date();
      events.emit("sensor:new:api", {
        controller: this.connection,
        sensor: this,
      });
    }
  }

  public getDataEntry() {
    const entryMetadata = this.connection.getOptions().getMetadata({
      staticData: this.staticData,
      dynamicData: this.dynamicData,
      responseData: this.responseData,
    });
    if (!entryMetadata) return null;

    const valueSource =
      entryMetadata.value !== undefined
        ? entryMetadata.value
        : this.dynamicData[entryMetadata.valueSource];

    return {
      brokerage: {
        broker: {
          id: this.connection.getName(),
          meta: {
            ...entryMetadata.broker,
          },
        },
        id: this.options.identifier,
        meta: {
          ...entryMetadata.brokerage,
        },
      },
      entity: {
        name: entryMetadata.entityName,
        meta: {
          ...entryMetadata.entity,
        },
      },
      feed: {
        metric: entryMetadata.metricName,
        meta: {
          ...entryMetadata.metric,
        },
      },
      timeseries: {
        unit: entryMetadata.unit,
        value: {
          time: entryMetadata.valueTime || this.lastUpdated,
          timeAccuracy:
            (this.lastSeen.getTime() - this.previousSeen.getTime()) / 1000,
          data: Array.isArray(valueSource) ? valueSource[0] : valueSource,
          type: entryMetadata.targetType,
        },
      },
    };
  }

  public consumeStatic(instanceData, responseData?: any) {
    this.staticData = instanceData;
    this.responseData = responseData;
  }

  public consumeData(instanceData: any, responseData?: any) {
    let comparator = this.connection.getOptions().acquisition
      .instanceComparator;
    if (!comparator) {
      comparator = (oldData: any, newData: any) =>
        JSON.stringify(oldData) !== JSON.stringify(newData);
    }

    if (
      comparator(
        this.instanceData,
        instanceData,
        this.responseData,
        responseData
      )
    ) {
      if (this.downloadInProgress) {
        log.verbose(
          `Missed data because download still pending for '${this.options.identifier}'.`
        );
        return;
      }

      log.debug(
        `API '${this.options.connection.getName()}' '${
          this.options.identifier
        }' has been updated.`
      );
      events.emit("sensor:cov:api", {
        controller: this.connection,
        sensor: this,
        oldValue: this.instanceData,
        newValue: instanceData,
      });
      this.lastUpdated = new Date();
      this.dynamicData = {
        ...instanceData,
        fileURL: [],
      };
      this.responseData = responseData;

      if (this.connection.getOptions().acquisition.autoDownloadImages) {
        const getFilename = this.connection.getOptions().acquisition
          .autoDownloadFilename;
        const dataJSON = JSON.stringify(instanceData);
        const imagePaths = dataJSON.match(/\"https?:\/\/[^\"]+\"/);
        const targetFilenames: string[] = [];
        this.downloadInProgress = true;
        Promise.all(
          imagePaths.map((image: string) => {
            const targetFilename = getFilename(instanceData, image);
            targetFilenames.push(targetFilename);
            const imageSource = image.replace(/(^\"|\"$)/g, "");
            log.debug(
              `Saving '${this.options.identifier}' to '${targetFilename}'`
            );
            this.dynamicData.fileURL.push(targetFilename);
            return fileDownloader.downloadFile(imageSource, targetFilename);
          })
        )
          .then((success: boolean[]) => {
            log.verbose(
              `Sending data entry for '${imagePaths[0].replace(
                /(^\"|\"$)/g,
                ""
              )}'.`
            );
            targetFilenames.forEach((fn: string) => {
              log.verbose(`  Stored to '${fn}`);
            });
            if (
              success &&
              success[0] &&
              (!Array.isArray(success[0]) || success[0][0])
            ) {
              this.sendDataEntry();
            }
            this.downloadInProgress = false;
          })
          .catch((e: Error) => (this.downloadInProgress = false));
      } else {
        this.sendDataEntry();
      }
    }

    this.previousSeen = this.lastSeen;
    this.lastSeen = new Date();
    this.instanceData = instanceData;
  }

  public getObjectIdentifier(): string {
    return this.options.identifier;
  }

  public getLastUpdated(): Date {
    return this.lastUpdated;
  }

  public getLastSeen(): Date {
    return this.lastSeen;
  }
}
