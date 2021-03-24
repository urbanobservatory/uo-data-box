// FIXME: fix lint
// @ts-nocheck
import { property } from 'lodash'
import {
  JsonController,
  Get,
  Param,
  QueryParam,
  QueryParams,
  OnUndefined,
  ForbiddenError,
  InternalServerError,
  BadRequestError,
  UseBefore,
  Req,
} from 'routing-controllers'
import { OpenAPI } from 'routing-controllers-openapi'

import { generateLinks } from 'shared/services/hateoas'
import { Platform, Sensor, Timeseries } from 'shared/types'

import { getApiKey, sharedQueryParams, universalDefinitions } from './common'
import { csvTransform } from './formatters'

const historicCsv = csvTransform((json: any) => {
  if (!json.historic) return { data: false }

  const platformName = json.timeseries.parentSensor.parentPlatform.name || ''
  const metricName = json.timeseries.parentSensor.observedProperty || ''

  return {
    headers: [
      'URBAN OBSERVATORY (http://www.urbanobservatory.ac.uk/)',
      'Licence info: http://www.urbanobservatory.ac.uk/licence/',
      `Platform: ${platformName}`,
      `Observed Property: ${metricName}`,
      `Platform ID: ${json.timeseries.parentSensor.parentPlatform.platformId}`,
      `Sensor ID: ${json.timeseries.parentSensor.sensorId}`,
      `Timeseries ID: ${json.timeseries.timeseriesId}`,
      `Units: ${json.timeseries.unit.name}`,
      `Stored in database as: ${json.timeseries.storage.name}`,
    ],
    data: (json.historic.values.length
      ? json.historic.values
      : [
          {
            time: new Date(),
            value: 'No data was available between the times requested',
            duration: null,
          },
        ]
    ).map((h: any) => ({
      time: h.time
        .toISOString()
        .replace(/([0-9-]{10})T([0-9:]{8})(\.[0-9]+)?Z/, '$1 $2'),
      value: h.value,
      'duration / observation window': h.duration,
    })),
    filename: `${platformName}-${metricName}-raw`
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase(),
  }
})

const openAPIHistoric = {
  summary:
    'Request historic data from a timeseries by its unique ID and a date range',
  description:
    'A date range may be specified to obtain historic readings from a timeseries, or the last 24 hours will be provided by default.',
  responses: {
    200: {
      description: 'Successful request',
      schema: {
        type: 'object',
        properties: {
          timeseries: {
            $ref: '#/definitions/Timeseries',
          },
          historic: {
            type: 'object',
            properties: {
              startTime: {
                type: 'string',
                format: 'date-time',
                description:
                  'The specified or computed start time, with any values before this time omitted.',
              },
              endTime: {
                type: 'string',
                format: 'date-time',
                description:
                  'The specified or computed end time, with any values after this time omitted.',
              },
              limited: {
                type: 'boolean',
                description:
                  'A flag indicating whether the historic series was truncated, because too many values would have been returned.',
              },
              values: {
                type: 'array',
                items: {
                  $ref: '#/definitions/TimeseriesEntry',
                },
              },
            },
            example: {
              startTime: '2018-02-11T10:31:04.065Z',
              endTime: '2018-02-13T10:31:04.065Z',
              limited: false,
              values: [
                {
                  time: '2018-02-12T10:30:40.125Z',
                  duration: -4.284,
                  value: 3.23809,
                },
                {
                  time: '2018-02-12T10:30:08.269Z',
                  duration: -4.386,
                  value: 3.31608,
                },
              ],
            },
          },
        },
      },
    },
    400: {
      description: 'Bad request',
      schema: {
        $ref: '#/definitions/BadRequest',
      },
    },
    403: {
      description: 'Forbidden',
      schema: {
        $ref: '#/definitions/Forbidden',
      },
    },
  },
  parameters: [
    {
      in: 'path',
      name: 'id',
      description: 'Timeseries ID to retrieve historic data for.',
      required: true,
      type: 'string',
      format: 'uuid',
    },
    {
      in: 'query',
      name: 'startTime',
      description:
        'Start period for the historic data to be retrieved, inclusive.',
      required: false,
      type: 'string',
      format: 'date-time',
      default: '24 hours in past',
    },
    {
      in: 'query',
      name: 'endTime',
      description:
        'End period for the historic data to be retrieved, inclusive.',
      required: false,
      type: 'string',
      format: 'date-time',
      default: '24 hours in future',
    },
    {
      in: 'query',
      name: 'outputAs',
      description:
        'Output format for the data, although JSON is always recommended and CSV outputs are computed from JSON.',
      required: false,
      type: 'string',
      default: 'json',
      enum: ['csv', 'json'],
    },
    ...sharedQueryParams,
  ],
}

@JsonController('/timeseries')
export class TimeseriesController {
  static Definitions = {
    Timeseries: {
      type: 'object',
      properties: {
        timeseriesId: {
          type: 'string',
          format: 'uuid',
          description: 'A unique identifier associated with this timeseries.',
        },
        unit: {
          required: true,
          $ref: '#/definitions/Unit',
        },
        storage: {
          required: true,
          $ref: '#/definitions/Storage',
        },
        derivatives: {
          type: 'array',
          description: 'Placeholder for future use.',
        },
        aggregation: {
          type: 'array',
          description: 'Placeholder for future use.',
        },
        assessments: {
          type: 'array',
          description: 'Placeholder for future use.',
        },
        latest: {
          description:
            'The most recent timeseries entry, only shown if within the last week, and a historic range has not been requested. Code must be resilient if `latest` is omitted from a timeseries.',
          $ref: '#/definitions/TimeseriesEntry',
        },
        links: {
          type: 'array',
          items: {
            $ref: '#/definitions/Link',
          },
        },
      },
      example: {
        timeseriesId: '371fbff8-f61d-4f66-99be-7d9de8ad51f2',
        unit: universalDefinitions.Unit.example,
        storage: universalDefinitions.Storage.example,
        derivatives: [],
        aggregation: [],
        assessments: [],
        latest: {
          time: '2018-02-12T10:30:40.125Z',
          duration: -2.1,
          value: 3.5,
        },
        links: generateLinks([
          {
            href: '/api/timeseries/371fbff8-f61d-4f66-99be-7d9de8ad51f2',
            rel: 'self',
          },
        ]),
      },
    },
    TimeseriesEntry: {
      type: 'object',
      description: 'A historic entry associated with a timeseries and a time.',
      properties: {
        time: {
          type: 'string',
          format: 'date-time',
          description: 'Date and time associated with the historic value',
        },
        duration: {
          type: 'number',
          description:
            'The duration this value applies to, or if negative, the window of error in which the value change could have occurred.',
        },
        value: {
          type: 'any',
          required: false,
          description:
            'The value associated with the time in the timeseries, unless the timeseries does not contain values (i.e. event only).',
        },
        error: {
          type: 'boolean',
          description:
            'Indication that an error occurred, and data could not be supplied.',
        },
        message: {
          type: 'string',
          description: 'Short description of why data could not be supplied.',
        },
        description: {
          type: 'string',
          description:
            'Verbose description of why an error occurred and data could not be supplied.',
        },
      },
      example: {
        time: '2018-02-12T10:30:40.125Z',
        duration: -2.1,
        value: 3.5,
      },
    },
  }

  @Get('/:id')
  @OnUndefined(404)
  @OpenAPI({
    summary: 'Request a single timeseries by its unique ID',
    description:
      'A single timeseries and its current value will be returned, if recent, provided a valid ID is supplied and permissions permit.',
    responses: {
      200: {
        description: 'Successful request',
        schema: {
          $ref: '#/definitions/Timeseries',
        },
      },
      400: {
        description: 'Bad request',
        schema: {
          $ref: '#/definitions/BadRequest',
        },
      },
    },
    parameters: [
      {
        in: 'path',
        name: 'id',
        description:
          'Timeseries ID to retrieve description and latest observed value for.',
        required: true,
        type: 'string',
        format: 'uuid',
      },
      ...sharedQueryParams,
    ],
  })
  async getOne(@Param('id') timeseriesId: string, @Req() request: any) {
    const parentSensor = await Sensor.getSensorFromTimeseries(timeseriesId)
    if (!parentSensor) return
    const timeseries = await Timeseries.getById(timeseriesId)
    if (!timeseries) return
    return await timeseries.toFilteredJSON(parentSensor, undefined, 'up', {
      apiKey: getApiKey(request) as string,
    })
  }

  @Get('/:platform/:observedProperty/:timeseries')
  @OnUndefined(404)
  @OpenAPI({
    summary:
      'Request a single timeseries by the combination of friendly names for the platform, sensor and timeseries',
    description:
      'A single timeseries and its current value will be returned, if recent, provided a valid set of names is supplied and permissions permit.',
    responses: {
      200: {
        description: 'Successful request',
        schema: {
          $ref: '#/definitions/Timeseries',
        },
      },
      400: {
        description: 'Bad request',
        schema: {
          $ref: '#/definitions/BadRequest',
        },
      },
    },
    parameters: [
      {
        in: 'path',
        name: 'platform',
        description:
          'Platform name under which to look for the observed property.',
        required: true,
        type: 'string',
      },
      {
        in: 'path',
        name: 'observedProperty',
        description: 'Observed property to retrieve timeseries from.',
        required: true,
        type: 'string',
      },
      {
        in: 'path',
        name: 'timeseries',
        description:
          'Timeseries name to retrieve description and latest observed value for.',
        required: true,
        type: 'string',
      },
      ...sharedQueryParams,
    ],
  })
  async getOneFromFriendlyNames(
    @Param('platform') platform: string,
    @Param('observedProperty') property: string,
    @Param('timeseries') timeseries: string,
    @Req() request: any
  ) {
    const ts = await Timeseries.getByFriendlyNames(
      platform,
      property,
      timeseries
    )
    if (!ts) return
    const parentSensor = await Sensor.getSensorFromTimeseries(ts.timeseriesId)
    if (!parentSensor) return
    return await ts.toFilteredJSON(parentSensor, undefined, 'up', {
      apiKey: getApiKey(request) as string,
    })
  }

  @Get('/:id/historic')
  @OnUndefined(404)
  @OpenAPI(openAPIHistoric)
  @UseBefore(historicCsv)
  async getHistoric(
    @Param('id') timeseriesId: string,
    @QueryParam('startTime') startTime?: string,
    @QueryParam('endTime') endTime?: string,
    @Req() request?: any
  ) {
    let endDateUnix = Date.parse(
      endTime || new Date(Date.now() + 3600 * 24 * 1000).toISOString()
    )
    let startDateUnix = Date.parse(
      startTime ||
        new Date(
          (isNaN(endDateUnix) ? Date.now() : endDateUnix) - 2 * 3600 * 24 * 1000
        ).toISOString()
    )

    if (isNaN(startDateUnix) || isNaN(endDateUnix)) {
      throw new BadRequestError('Date format could not be parsed.')
    }

    const parentSensor = await Sensor.getSensorFromTimeseries(timeseriesId)
    if (!parentSensor) return undefined

    const requestDetail = { apiKey: getApiKey(request) as string }
    if (await parentSensor.isRestricted(null, requestDetail)) {
      throw new ForbiddenError('No access to this timeseries.')
    }

    const singleTS = await Timeseries.getById(timeseriesId)
    return await singleTS.getHistoric(
      new Date(startDateUnix),
      new Date(endDateUnix),
      requestDetail
    )
  }

  @Get('/:platform/:observedProperty/:timeseries/historic')
  @OnUndefined(404)
  @OpenAPI({
    ...openAPIHistoric,
    parameters: [
      ...openAPIHistoric.parameters,
      {
        in: 'path',
        name: 'platform',
        description:
          'Platform name under which to look for the observed property.',
        required: true,
        type: 'string',
      },
      {
        in: 'path',
        name: 'observedProperty',
        description: 'Observed property name to retrieve timeseries from.',
        required: true,
        type: 'string',
      },
      {
        in: 'path',
        name: 'timeseries',
        description:
          'Timeseries name to retrieve description and latest observed value for.',
        required: true,
        type: 'string',
      },
    ],
  })
  @UseBefore(historicCsv)
  async getHistoricFromFriendlyNames(
    @Param('platform') platform: string,
    @Param('observedProperty') property: string,
    @Param('timeseries') timeseries: string,
    @QueryParam('startTime') startTime?: string,
    @QueryParam('endTime') endTime?: string,
    @Req() request?: any
  ) {
    const ts = await this.getOneFromFriendlyNames(
      platform,
      property,
      timeseries,
      request
    )
    if (!ts) return
    return this.getHistoric(ts.timeseriesId, startTime, endTime, request)
  }
}
