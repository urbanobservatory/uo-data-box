import * as fs from 'fs'
import * as jsonpack from 'jsonpack'

import { Config } from 'shared/services/config'
import { events } from 'shared/services/events'
import { log } from 'shared/services/log'

export interface FileCacheOptions {
  saveFrequency?: number
  pull: (data: any) => any
  push: () => any
  autoStart?: boolean
  filename?: string
  directory?: string
  compress?: boolean
}

export class FileCache {
  private options: FileCacheOptions
  private filename: string | null = null
  private writeTimer: any = null
  private fileExists: boolean = false

  constructor(options: FileCacheOptions) {
    this.options = options

    // Filename is not mandatory to create the class, but we can't write until we have one
    if (this.options.filename) {
      this.setFilename(this.options.filename)
    }
  }

  public startMonitoring() {
    if (this.writeTimer) return
    this.writeTimer = setInterval(
      () => this.writeFile(),
      (this.options.saveFrequency ||
        Number.parseInt(Config.getValue('file_cache_frequency'), 10) ||
        10000) * 1000
    )
    this.addEventListeners()
  }

  public endMonitoring() {
    if (!this.writeTimer) {
      this.removeEventListeners()
      return
    }
    clearInterval(this.writeTimer)
    this.writeTimer = null
    this.removeEventListeners()
  }

  private readonly appEndHandler = () => {
    if (!this.writeTimer) return
    log.verbose(
      `Received app termination notification. Should discontinue file caching (FN: ${this.filename})...`
    )
    this.writeFile()
    this.endMonitoring()
  }

  private addEventListeners() {
    events.on('app:end:*', this.appEndHandler)
  }

  private removeEventListeners() {
    events.removeListener('app:end:*', this.appEndHandler)
  }

  public doesFileExist() {
    return this.fileExists
  }

  public setFilename(fn: string) {
    this.filename = fn
    if (
      (this.filename && this.options.autoStart === undefined) ||
      this.options.autoStart
    ) {
      this.startMonitoring()
      this.fileExists = fs.existsSync(
        `./${this.options.directory || 'cache'}/${this.filename}.${
          this.options.compress ? 'lzw' : 'json'
        }`
      )
    }
  }

  public async writeFile() {
    if (!this.filename) {
      return Promise.reject(
        new Error('No filename has yet been assigned for the cache file.')
      )
    }

    return new Promise((resolve: Function, reject: Function) => {
      const filePath = `./${this.options.directory || 'cache'}/${
        this.filename
      }.${this.options.compress ? 'pack' : 'json'}`

      let jsonData: any = JSON.stringify(this.options.push(), null, 2)

      if (this.options.compress) {
        log.verbose(`Compressing JSON data...`)
        jsonData = jsonpack.pack(jsonData)
        log.verbose(`Finished compressing JSON data...`)
      }

      fs.writeFile(
        filePath,
        jsonData,
        this.options.compress ? 'binary' : 'utf8',
        (e: Error | null) => {
          if (!e) {
            log.verbose(
              `Successfully stored cache data for '${this.filename}' to file.`
            )
            this.fileExists = true
            resolve()
          } else {
            reject(e)
          }
        }
      )
    }).catch((e: Error) => {
      log.error(`Failed to write file-based cache data.`)
      log.error(`  ${e.message}`)
      log.debug(`  ${e.stack}`)
    })
  }

  public async readFile() {
    if (!this.filename) {
      return Promise.reject(
        new Error('No filename has yet been assigned for the cache file.')
      )
    }

    return new Promise((resolve: Function, reject: Function) => {
      const filePath = `./${this.options.directory || 'cache'}/${
        this.filename
      }.${this.options.compress ? 'pack' : 'json'}`
      fs.readFile(
        filePath,
        this.options.compress ? 'binary' : 'utf8',
        (e: Error | null, data: string) => {
          if (!e) {
            if (this.options.compress) {
              data = jsonpack.unpack(data)
            }
            this.options.pull(JSON.parse(data))
            resolve()
          } else {
            log.warn(
              `Failed to read file-based cache data from '${this.filename}'.`
            )
            log.warn(`  ${e.message}`)
            log.debug(`  ${e.stack}`)
            resolve([])
          }
        }
      )
    })
  }
}
