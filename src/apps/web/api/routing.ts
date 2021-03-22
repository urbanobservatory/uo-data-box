import { Action } from 'routing-controllers'

import { GenericErrorHandler } from './error'
import {
  PlatformController,
  SensorController,
  SummaryController,
  TimeseriesController,
} from 'shared/controllers'
import { Config as AppConfig, log } from 'shared/services'

const majorVersion = 2

const routePrefix = `/api/v${majorVersion}`

export const routingOptions = () => {
  const [apiUrl, apiDomain]: any = AppConfig.getValue('api_base').match(
    /:\/\/([^\/]+)\//
  )

  let instanceControllers: any = []
  try {
    instanceControllers = Object.values(require(`./${apiDomain}/controllers`))
  } catch (e) {
    log.verbose(
      'Unable to load additional controllers for the specified API base.'
    )
  }

  return {
    cors: true,
    defaultErrorHandler: false,
    routePrefix,
    controllers: [
      PlatformController,
      SensorController,
      TimeseriesController,
      SummaryController,
      ...instanceControllers,
    ],
    middlewares: [GenericErrorHandler],
    currentUserChecker: async (action: Action) => {
      // TODO: Implement authorisation processing
      return false
    },
    authorizationChecker: async (action: Action, roles: string[]) => {
      // TODO: Implement authorisation processing
      return false
    },
  }
}

export const hateoasOptions = {
  majorVersion,
  baseURL: AppConfig.getValue('api_base'),
}
