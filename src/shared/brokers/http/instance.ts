import * as fs from 'fs'
import * as path from 'path'
import { events } from 'shared/services/events'
import { log, readRequestDataInMemory } from 'shared/services'
import { File } from 'shared/services/http/types'

import { HTTPController } from './controller'
import { Datapoint } from '../datapoint'

export interface HTTPInstanceOptions {
  connection?: HTTPController
  instanceKey?: string
  identifier?: string
}

export class HTTPInstance extends Datapoint {
  protected connection: any
  private options: HTTPInstanceOptions
  private previousSeen: Date = new Date(0)
  private lastSeen: Date = new Date(0)
  private lastUpdated: Date = new Date(0)
  private instanceData: any = {}
  private processingInProgress = false

  private responseData: any = {}
  private staticData: any = {}
  private dynamicData: any = {}

  constructor(options: HTTPInstanceOptions) {
    super(options)
    this.options = options
    events.emit('uploader:new:api', {
      controller: this.connection,
      uploader: this,
    })
  }

  public getDataEntry() {
    const entryMetadata = this.connection.getOptions().getMetadata({})
    if (!entryMetadata) return null

    const valueSource =
      entryMetadata.value !== undefined
        ? entryMetadata.value
        : this.instanceData[entryMetadata.valueSource] // image paths

    return {
      brokerage: {
        broker: {
          id: this.connection.getName(),
          meta: {},
        },
        id: this.getObjectIdentifier(), //  camera id from post
        meta: {},
      },
      platform: {
        name: entryMetadata.platformName, // lookup table for different entities (id's from config)
        meta: entryMetadata.platform, // deployment and other info
      },
      sensor: {
        observedProperty: entryMetadata.metricName, // lookup table for different entities (id's from config)
        meta: {},
      },
      timeseries: {
        unit: entryMetadata.unit, // jpeg, png (look utmc api)
        value: {
          // time: entryMetadata.valueTime || this.lastUpdated, // received time now()
          time: new Date(),
          timeAccuracy: 0,
          data: Array.isArray(valueSource) ? valueSource[0] : valueSource,
          type: entryMetadata.targetType, // file type
        },
      },
    }
  }

  public handlePost(request: any, response: any, body: any) {
    readRequestDataInMemory(
      request,
      response,
      body,
      this.connection.getRequestOptions().contentLength,
      (error: any, data: any) => {
        if (error || !data) {
          log.warn(`Error during HTTP request.`)
          log.warn(`  ${(error || { message: 'Unknown' }).message}`)
          log.debug(`  ${(error || { stack: '' }).stack}`)
          return
        }
        // TODO: needs cleaning up and addition of multiple files in post
        // look for files in the post
        if (data.files) {
          log.verbose(`Received ${data.files.length} files`)
          const targetFilenames: string[] = []
          this.instanceData = { fileURL: targetFilenames }
          this.processingInProgress = true
          Promise.all(
            data.files.map((file: File) => {
              // Check if file allowed
              if (
                !this.connection
                  .getOptions()
                  .processing.allowedIds.includes(file.name)
              ) {
                log.verbose(`Instance id ${file.name} not recognised.`)
                return
              }
              return new Promise((resolve: Function, reject: Function) => {
                const getFilename = this.connection.getOptions().processing
                  .uploadFilename
                const targetFilename = getFilename(file.name, file.filename)
                // TODO: check with multiple files sending
                this.options.identifier = file.name
                this.instanceData.fileURL.push(targetFilename)
                this.assertChain(path.dirname(`/archive/${targetFilename}`))
                  .then(() => {
                    log.debug(`Processing uploaded file ${targetFilename}...`)
                    // save files
                    const stream = fs.createWriteStream(
                      `/archive/${targetFilename}`
                    )
                    stream.write(file.data, 'binary', (err) => {
                      if (err) {
                        reject(err)
                        return
                      }
                      stream.close()
                      log.verbose(`Completed saving ${targetFilename}.`)
                      // this.sendDataEntry();
                      resolve(true)
                    })
                  })
                  .catch((error: Error) => {
                    log.warn(`Error during remote file upload processing.`)
                    log.warn(`  File: ${file.name}`)
                    log.warn(`  ${error.message}`)
                    log.debug(`  ${error.stack}`)
                    // this.processingInProgress = false;
                    throw error
                  })
              })
            })
          )
            .then((success) => {
              if (
                success &&
                success[0] &&
                (!Array.isArray(success[0]) || success[0][0])
              ) {
                log.verbose(`Sending data entry...`)
                let dataEntry = JSON.stringify(this.getDataEntry())
                log.verbose(dataEntry)
                this.sendDataEntry()
              }
              this.processingInProgress = false
            })
            .catch((e: Error) => (this.processingInProgress = false))
          if (data.values.length) {
            log.verbose(`Processing additional form parameters...`)
            // TODO: handle other form Data
            // this.sendDataEntry();
          }
        }
        // look for form values in post
        else {
          // all other supported rawdata type
          log.verbose(`Processing uploaded data...`)
          // const datastring = JSON.stringify(data);
          // log.verbose(datastring);
          //TODO: handle JSON and URL data
        }
        this.processingInProgress = false
      }
    )
  }

  public getObjectIdentifier() {
    return this.options.identifier
  }

  private async assertChain(path: any, mask: number = 0o777) {
    const components = path.split('/')
    let prefix = ''

    for (let i = 0; i < components.length; i++) {
      prefix += `${components[i]}/`
      await this.assertDirectory(prefix, mask)
    }
  }

  private assertDirectory(
    path: string,
    mask: number = 0o777,
    position: number = 0
  ): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      fs.mkdir(path, mask, function (err) {
        if (err) {
          if (err.code == 'EEXIST') {
            resolve(null)
          } else {
            reject(err)
          }
        } else {
          resolve()
        }
      })
    })
  }
}
