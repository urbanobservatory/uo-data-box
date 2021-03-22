import { AMQP, AMQPConnection } from 'shared/services/amqp'
import { Config } from 'shared/services/config'
import { log } from 'shared/services/log'
import { IncomingStream } from 'shared/services/receiver'
import { Controller } from './controller'

// Not sure why we'd ever want to extend this, but the option
// is here, just because of separation of concerns.
export interface DatapointEntry extends IncomingStream {}

export abstract class Datapoint {
  private aqmp: any
  protected connection: any

  constructor(options: any) {
    this.connection = options.connection
  }

  abstract getDataEntry(): DatapointEntry | null

  public async sendDataEntry() {
    if (!this.aqmp) {
      this.aqmp = await AMQP()
    }

    try {
      let changeData = this.getDataEntry()
      if (!changeData) return

      const controllerPreHooks = this.connection.getOptions().preSendHooks
      if (controllerPreHooks && controllerPreHooks.length) {
        await Promise.all(
          controllerPreHooks.map(async (hook: any) => {
            changeData = await hook(changeData)
          })
        )
      }

      await this.aqmp.sendToExchange(
        { name: Config.getValue('broker_exchange_cov') },
        changeData
      )
    } catch (e) {
      log.error(`Failed to submit data to AMQP exchange for processing.`)
      log.error(`  ${e.message}`)
      log.debug(`  ${e.stack}`)
    }
  }
}
