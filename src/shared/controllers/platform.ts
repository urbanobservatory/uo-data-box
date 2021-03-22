import { Response } from 'express'
import {
  JsonController,
  Get,
  Param,
  QueryParam,
  QueryParams,
  Req,
  OnUndefined,
} from 'routing-controllers'
import { OpenAPI } from 'routing-controllers-openapi'

import { Platform, Sensor } from 'shared/types'

import { SensorController } from './sensor'
import { getApiKey, sharedQueryParams } from './common'

@JsonController('/platform')
export class PlatformController {
  static Definitions = {
    Platform: {
      type: 'object',
      properties: {
        platformId: {
          type: 'string',
          description: 'A unique identifier associated with this platform.',
        },
        name: {
          type: 'string',
          description:
            'Friendly name associated with the platform, not used internally.',
        },
        meta: {
          type: 'object',
          description:
            'Metadata associated with the platform, such as room numbers or building name.',
        },
        position: {
          type: 'array',
        },
        sensor: {
          type: 'array',
          items: {
            $ref: '#/definitions/Sensor',
          },
        },
      },
      example: {
        platformId: 'e33f9ed0-cb60-4326-8ea6-4f166dd0c767',
        name: 'Urban Sciences Building: Floor 2: Room 2.048 Zone 1',
        meta: {
          building: 'Urban Sciences Building',
          roomZone: '1',
          roomNumber: '2.048',
          buildingFloor: '2',
        },
        position: [],
        sensor: [SensorController.Definitions.Sensor.example],
      },
    },
  }

  @Get()
  @OpenAPI({
    summary: 'List all entities (paginated)',
    description:
      'Paginated list of all entities, including their associated sensors and timeseries.',
    responses: {
      200: {
        description: 'Successful request',
        schema: {
          type: 'object',
          properties: {
            pagination: {
              $ref: '#/definitions/Pagination',
            },
            items: {
              type: 'array',
              items: {
                $ref: '#/definitions/Platform',
              },
            },
          },
        },
      },
    },
    parameters: [
      {
        in: 'query',
        name: 'page',
        description:
          'Page number to return results from, will default to `1` if omitted.',
        required: false,
        default: 1,
        type: 'number',
      },
      {
        in: 'query',
        name: 'pageSize',
        description:
          'Request a number of items per page, however the API may constrain the range.',
        required: false,
        default: 10,
        type: 'number',
      },
      {
        in: 'query',
        name: 'meta:{key}={value}',
        description: 'Filter based on metadata, e.g. `meta:roomNumber=2.048`',
        required: false,
        type: 'any',
      },
      {
        in: 'query',
        name: 'brokerage:sourceId={value}',
        description:
          'Filter based on the ID at the source controller or broker, such as the BACNET ID within a building. This is especially useful if you have some prior knowledge of the systems, or are using the data in combination with related data sources. Note that source IDs are not required to confirm to any standard, other than the controller ID and source ID combined must be a unique pair.',
        required: false,
        type: 'string',
      },
      {
        in: 'query',
        name: 'name',
        description:
          'Filter to only include entities which partially match the name specified. Each word is considered to be additive and case insensitive, so phrases must be surrounded by double quotes. ' +
          'For example, to return only room 3.04, use `name="Room 3.04"`.',
        required: false,
        type: 'string',
      },
      {
        in: 'query',
        name: 'metric',
        description:
          'Filter to only include entities with, and sensors therein, matching at least one of the metrics specified. Partial matches on metrics are included, and each word is considered to be additive and case insensitive, so phrases must be surrounded by double quotes. ' +
          'For example, to return the occupancy and room temperature, but exclude flow temperatures, use `metric=occupied+"room temperature"`.',
        required: false,
        type: 'string',
      },
    ],
  })
  async getAll(
    @QueryParam('page') page: number,
    @QueryParam('pageSize') pageSize: number,
    @QueryParams() params: any,
    @Req() request?: any
  ) {
    const allEntities = await Platform.getPaginated(
      {
        pageNumber: page,
        pageSize,
      },
      params
    )
    allEntities.items = await Promise.all(
      allEntities.items.map(
        async (platform: Platform) =>
          await platform.toFilteredJSON(undefined, undefined, {
            // TODO: find better way
            apiKey: getApiKey(request) as string,
          })
      )
    )
    return allEntities
  }

  @Get('/:id')
  @OnUndefined(404)
  @OpenAPI({
    summary: 'Request a single platform by its unique ID',
    description:
      'A single platform and its associated sensors will be returned, if a valid ID is supplied and permissions permit.',
    responses: {
      200: {
        description: 'Successful request',
        schema: {
          $ref: '#/definitions/Platform',
        },
      },
      400: {
        description: 'Bad request',
        schema: {
          $ref: '#/definitions/BadRequest',
        },
      },
    },
    parameters: [...sharedQueryParams],
  })
  async getOne(@Param('id') platformId: string, @Req() request?: any) {
    const platform = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      platformId
    )
      ? await Platform.getByFriendlyName(platformId)
      : await Platform.getById(platformId)
    if (!platform) return
    return await platform.toFilteredJSON(undefined, undefined, {
      apiKey: getApiKey(request) as string,
    })
  }
}
