import * as Emitter from 'eventemitter2'
import { createInterface } from 'readline'

import { log } from 'shared/services/log'

class AppEvents extends Emitter.EventEmitter2 {
  constructor() {
    super({
      wildcard: true,
      delimiter: ':',
      maxListeners: 100,
    })
    this.addAppEvents()
  }

  private addAppEvents() {
    process.on('exit', () => this.dispatchEnd('exit'))
    process.on('SIGINT', () => this.dispatchEnd('sigint'))
    process.on('SIGUSR1', () => this.dispatchEnd('sigusr1'))
    process.on('SIGUSR2', () => this.dispatchEnd('sigusr2'))
    // process.on('uncaughtException', () => this.emit('error'));

    if (process.platform.toLowerCase() === 'win32') {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      rl.on('SIGINT', () => {
        // process.emit("SIGINT");
        setTimeout(() => process.exit(0), 500)
      })
    }

    process.on('uncaughtException', (e: Error) => {
      log.error('Otherwise uncaught error...')
      log.error(`  ${e.message}`)
      log.error(`  ${e.stack}`)
    })
  }

  private dispatchEnd(reason: string) {
    log.info(`Application is terminating. Received '${reason}' signal...`)
    this.emit(`app:end:${reason}`)
  }
}

export const events = new AppEvents()
