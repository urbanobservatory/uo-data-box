import * as fs from 'fs';

import {log} from 'shared/services/log';

import {ColumnInstance} from './instance';
import {Controller, ControllerOptions} from '../controller';

export interface FileControllerOptions extends ControllerOptions {
  discovery: {};
  updateInterval: number;
  acquisition: FileRequestOptions;
  getMetadata?: (objectData: any) => {[key: string]: any};
}

export interface FileRequestOptions {
  directory: string;
  pattern: string;
  hasHeaders: boolean;
  hasUnits: boolean;
  separator: string;
  retryInterval: number;
  columnTime: string;
  unitOverrides?: (c: string[]) => string[];
  columnOverrides?: (c: string[]) => string[];
  valueOverrides?: (c: string[]) => string[];
  dateParser?: (d: string) => Date;
  entityName?: (fn: string) => string;
  instanceToBroker?: (fn: string) => string;
  instanceToKey: (fn: string, entityName: string, variable: string) => string;
}

export interface FileMetric {
  key: string,
  broker: string,
  entity: string,
  metric: string,
  units: string,
  type: string,
  timeseries: any[],
  earliestData: Date,
  latestData: Date
}

export interface ColumnCacheEntry {
  identifier: string;
  lastEntry: string;
}

export class FileController extends Controller {
  protected classType: string = 'File';
  protected options: FileControllerOptions;

  private instances: {[key: string]: ColumnInstance} = {};
  private acquisitionTimer: any;
  private acquisitionInProgress: boolean = false;

  constructor (options: FileControllerOptions) {
    super();
    this.options = options;
  }

  public async connect() {
    await super.connect();
    return await this.fileCache.readFile();
  }

  public getMetadata() {
    return {
      sourceType: this.classType
    };
  }

  public getOptions(): FileControllerOptions {
    return this.options;
  }

  public saveToCache(): ColumnCacheEntry[] {
    return Object.keys(this.instances).map((id: string): ColumnCacheEntry => ({
      identifier: id,
      lastEntry: this.instances[id].getLastSent()
    }));
  }

  public loadFromCache(data: ColumnCacheEntry[]) {
    (data || []).forEach((c: ColumnCacheEntry) => {
      let o = this.instances[c.identifier];
      if (!o) {
        this.instances[c.identifier] = new ColumnInstance({
          connection: this,
          identifier: c.identifier
        });
        o = this.instances[c.identifier]
      }
      o.setLastSent(c.lastEntry);
    });
  }

  protected startDiscovery() {
    // No discovery necessary for files
  }

  protected endDiscovery() {
    // No discovery for files
  }

  protected startAcquisition() {
    log.info(`Starting automatic data acquisition for ${this.options.name}...`);
    this.acquisitionTimer = setInterval(() => this.updateValues(), this.options.updateInterval);
  }

  protected endAcquisition() {
    if (!this.acquisitionTimer) return;
    log.info(`Terminating data acquisition for ${this.options.name}.`);
    clearInterval(this.acquisitionTimer);
    this.acquisitionTimer = null;
  }

  private async updateValues() {
    if (this.acquisitionInProgress) return;
    this.acquisitionInProgress = true;

    let acquisitionResponse;
    try {
      acquisitionResponse = await this.parseDirectory(this.options.acquisition)
      .then((response: any) => {
        this.acquisitionInProgress = false;
        return response;
      });
    } catch (error) {
      log.warn(`Failed in acquisition request for controller ${this.options.name}.`);
      log.warn(`  ${error.message}`);
      log.debug(`  ${error.stack}`);
      this.acquisitionInProgress = false;
      return;
    }

    Object.keys(acquisitionResponse).forEach(
      (fn: string) => {
        Object.keys(acquisitionResponse[fn]).forEach(
          (sourceId: string) => {
            if (!this.instances[sourceId]) {
              log.debug(`Encountered file response for '${sourceId}' previously unknown. Instance created.`);
              this.instances[sourceId] = new ColumnInstance({
                connection: this,
                identifier: sourceId
              });
              return;
            }

            this.instances[sourceId].consumeData(acquisitionResponse[fn][sourceId]);
          }
        );
      }
    );

    log.info(`Successfully updated '${this.options.name}' from ${Object.keys(acquisitionResponse).length} files.`);

    this.acquisitionInProgress = false;
  }

  private async parseDirectory(request: FileRequestOptions) {
    const directoryContents = fs.readdirSync(request.directory);
    const fileTest = new RegExp(request.pattern);

    const sourceFiles = directoryContents.filter(
      (fn: string) => fileTest.test(fn)
    );

    const allFileData = {};
    await Promise.all(
      sourceFiles.map(
        async (fn: string) => {
          const fileData = await this.parseFile(`${request.directory}/${fn}`, request);
          Object.assign(
            allFileData,
            fileData
          );
        }
      )
    );

    return allFileData;
  }

  private parseFile(filepath: string, request: FileRequestOptions) {
    return new Promise((resolve: Function, reject: Function) => {
      fs.readFile(filepath, 'ascii', (err: Error, contents: string) => {
        let columnNames = [];
        let columnUnits = [];

        if (err) {
          log.warn(err.message);
          resolve({});
          return;
        }

        const lines = contents.split('\n');
        const unitMap = {};
        const variableData = {};

        lines.forEach((line: string, index: number) => {
          // Strip Windows line endings...
          let cleanLine = line.replace('\r', '');
          let arrayLine = cleanLine.split(request.separator);
          let splitLine = arrayLine.map((v: string) => v.trim());

          if (index === 0) {
            columnNames = request.hasHeaders ?
              splitLine.map((header: string) => header) :
              splitLine.map((header: string, index: number) => `Column ${index}`);
            if (request.columnOverrides) {
              columnNames = request.columnOverrides(columnNames);
            }
            if (request.hasHeaders) {
              return;
            }
          }

          if (index === 1) {
            columnUnits = request.hasUnits ?
              splitLine.map((header: string) => header) :
              splitLine.map(() => 'no units');
            if (request.unitOverrides) {
              columnUnits = request.unitOverrides(columnUnits);
            }
            columnUnits.forEach(
              (unitName: string, unitIdx: number) => {
                if (unitName === undefined || unitName === '') return;
                unitMap[columnNames[unitIdx]] = unitName;
              }
            );
            if (request.hasUnits) {
              return;
            }
          }

          if (request.valueOverrides) {
            splitLine = request.valueOverrides(splitLine);
          }

          if (splitLine.length !== columnNames.length) {
            if (cleanLine !== '') {
              log.verbose('File data has row with different column count to headers. Row ignored.');
            }
            return;
          }

          // Convert row to associative object
          const rowData = {};
          splitLine.forEach(
            (colVal: string, colIdx: number) => {
              if (colVal === undefined || colVal === '') return;
              rowData[columnNames[colIdx]] = colVal;
            }
          );

          // Parse times here
          rowData[request.columnTime] = request.dateParser ?
            request.dateParser(rowData[request.columnTime]) :
            new Date(rowData[request.columnTime]);

          const entityName: any = request.entityName ? request.entityName(filepath) : 'File source';

          // Break data down by metric
          Object.keys(rowData).forEach((column: string) => {
            if (column === request.columnTime) return;

            const columnKey = request.instanceToKey(filepath, entityName, column);

            if (!variableData[columnKey]) {
              variableData[columnKey] = <FileMetric>{
                key: columnKey,
                broker: request.instanceToBroker(filepath),
                entity: entityName,
                metric: column,
                units: unitMap[column],
                type: 'Real',
                timeseries: [],
                earliestData: null,
                latestData: null
              };
            }

            if (variableData[columnKey].earliestData === null ||
                variableData[columnKey].earliestData.getTime() > rowData[request.columnTime]) {
              variableData[columnKey].earliestData = rowData[request.columnTime];
            }

            if (variableData[columnKey].latestData === null ||
                variableData[columnKey].latestData.getTime() < rowData[request.columnTime]) {
              variableData[columnKey].latestData = rowData[request.columnTime];
            }

            variableData[columnKey].timeseries.push({
              time: rowData[request.columnTime],
              value: rowData[column]
            });
          });
        });

        // Sort the timeseries data
        Object.keys(variableData).forEach((variable: string) => {
          variableData[variable].timeseries.sort(
            (t1: any, t2: any) => t1.time.getTime() - t2.time.getTime()
          );
        });

        resolve({
          [filepath]: variableData
        });
      });
    });
  }
}
