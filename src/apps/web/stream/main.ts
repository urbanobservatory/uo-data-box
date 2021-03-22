import {
  AMQP,
  log,
  Config as AppConfig,
  WebsocketServer,
} from 'shared/services'
import { WebsocketSignal } from 'shared/services/websockets/types'
import { initialiseSQL } from 'shared/drivers/sql'
import { Sensor } from 'shared/types'

AppConfig.addDefaults({
  broker_queue_stream: 'uo.master.stream',
  broker_amqp_host: 'localhost',
  broker_amqp_username: 'stream',
  broker_amqp_password: '--removed--',
})

// TODO: implement proper handling of errors
// Catch unhandling unexpected exceptions
process.on('uncaughtException', (error: Error) => {
  log.verbose(`uncaughtException ${error.message}`)
  log.debug(`  ${error.stack}`)
  process.exit(1)
})
// Catch unhandling rejected promises
process.on('unhandledRejection', (reason: any) => {
  log.verbose(`unhandledRejection ${reason}`)
  log.debug(`  ${reason.stack}`)
  process.exit(1)
})

log.info('Stream application is starting...')

initialiseSQL()
;(async function streamService() {
  const websocketServer = new WebsocketServer({
    port: ~~AppConfig.getValue('websocket_server_port') || 8080,
  })
  await websocketServer.startListening()

  const queueService = await AMQP({
    hostname: AppConfig.getValue('broker_amqp_host'),
    username: AppConfig.getValue('broker_amqp_username'),
    password: AppConfig.getValue('broker_amqp_password'),
    port: parseInt(AppConfig.getValue('broker_amqp_port'), 10) || 5672,
  })

  // Obtain list of restricted sensors
  log.info('Requesting list of restricted sensors...')
  const restrictedSensors = (await Sensor.getAllRestricted()).map(
    (sensor: any) => sensor.brokerage[0].sourceId
  )
  log.info(`${restrictedSensors.length} sensors are restricted.`)

  // TODO: can be null?
  queueService!.consumeQueue(
    AppConfig.getValue('broker_queue_stream'),
    (message: any) => {
      if (!message) return
      const data = JSON.parse(message.content.toString())

      if (restrictedSensors.indexOf(data.brokerage.id) >= 0) {
        log.verbose(
          `Excluding restricted ID '${data.brokerage.id}' from broadcast`
        )
        return
      }

      websocketServer.broadcast({
        signal: WebsocketSignal.TIMESERIES_STREAM_COV,
        data,
      })
    }
  )
})()
