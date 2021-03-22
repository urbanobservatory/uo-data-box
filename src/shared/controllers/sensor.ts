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
  Req,
} from 'routing-controllers'
import { OpenAPI } from 'routing-controllers-openapi'

import { generateLinks } from 'shared/services/hateoas'
import { Sensor } from 'shared/types'

import { getApiKey, sharedQueryParams, universalDefinitions } from './common'
import { TimeseriesController } from './timeseries'

@JsonController('/sensor')
export class SensorController {
  static Definitions = {
    Sensor: {
      type: 'object',
      properties: {
        sensorId: {
          type: 'string',
          format: 'uuid',
          description: 'A unique identifier associated with this sensor.',
        },
        observedProperty: {
          type: 'string',
          description:
            'A short string identifier of the observed property, e.g. air-temperature.',
        },
        meta: {
          type: 'object',
          description:
            'Metadata associated with the sensor, such as the room number or floor.',
        },
        provider: {
          type: 'object',
          description:
            'A description of the organisation or person providing the data, and the licence under which it is provided.',
          properties: {
            providerId: {
              type: 'string',
              format: 'uuid',
              description:
                'A unique identifier associated with this provider, licence, organisation and contact data.',
            },
            organisation: {
              $ref: '#/definitions/Organisation',
            },
            contact: {
              $ref: '#/definitions/Contact',
            },
            licence: {
              $ref: '#/definitions/Licence',
            },
          },
        },
        technology: {
          type: 'object',
          description: 'Placeholder for future information.',
        },
        hardware: {
          type: 'object',
          description: 'Placeholder for future information.',
        },
        service: {
          type: 'array',
          description: 'Placeholder for future information.',
        },
        timeseries: {
          type: 'array',
          items: {
            $ref: '#/definitions/Timeseries',
          },
        },
      },
      example: {
        sensorId: 'eeaa50bb-fb5f-47be-a6ab-eb4c67debecb',
        observedProperty: 'room-temperature',
        meta: {
          building: 'Urban Sciences Building',
          roomNumber: '2.048',
          buildingFloor: '2',
        },
        provider: {
          providerId: '986cd257-b50d-4fe8-8439-dc2a69271172',
          organisation: universalDefinitions.Organisation.example,
          contact: universalDefinitions.Contact.example,
          licence: universalDefinitions.Licence.example,
        },
        technology: null,
        hardware: null,
        service: [],
        timeseries: [TimeseriesController.Definitions.Timeseries.example],
        links: generateLinks([
          {
            href: '/api/sensor/eeaa50bb-fb5f-47be-a6ab-eb4c67debecb',
            rel: 'self',
          },
        ]),
      },
    },
  }

  @Get('/:id')
  @OnUndefined(404)
  @OpenAPI({
    summary: 'Request a single sensor by its unique ID',
    description:
      'A single sensor and its descendant timeseries will be returned.',
    responses: {
      200: {
        description: 'Successful request',
        schema: {
          $ref: '#/definitions/Sensor',
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
          'Sensor ID to retrieve description and associated set of timeseries for.',
        required: true,
        type: 'string',
        format: 'uuid',
      },
      ...sharedQueryParams,
    ],
  })
  async getOne(@Param('id') sensorId: string, @Req() request?: any) {
    const sensor = await Sensor.getById(sensorId)
    if (!sensor) return
    return await sensor.toFilteredJSON(null, 'both', {
      apiKey: getApiKey(request) as string,
    })
  }

  @Get('/:platform/:observedProperty')
  @OnUndefined(404)
  @OpenAPI({
    summary:
      'Request a single sensor by the platform name and observed property id',
    description:
      'A single sensor and its descendant timeseries will be returned if one can be matched successfully. If developing code, we recommend using the UUID form for accessing sensors as this alleviates name changes.',
    responses: {
      200: {
        description: 'Successful request',
        schema: {
          $ref: '#/definitions/Sensor',
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
        description: 'Platform name under which to look for the metric.',
        required: true,
        type: 'string',
      },
      {
        in: 'path',
        name: 'observedProperty',
        description:
          'Observed property to retrieve description and associated set of timeseries for.',
        required: true,
        type: 'string',
      },
      ...sharedQueryParams,
    ],
  })
  async getOneFromFriendlyNames(
    @Param('platform') platform: string,
    @Param('observedProperty') property: string,
    @Req() request?: any
  ) {
    const sensor = await Sensor.getByFriendlyNames(platform, property)
    if (!sensor) return
    return await sensor.toFilteredJSON(null, 'both', {
      apiKey: getApiKey(request) as string,
    })
  }
}
