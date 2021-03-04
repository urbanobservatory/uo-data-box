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
import { Feed } from 'shared/types'

import { getApiKey, sharedQueryParams, universalDefinitions } from './common'
import { TimeseriesController } from './timeseries'

@JsonController('/sensors/feed')
export class FeedController {
  static Definitions = {
    Feed: {
      type: 'object',
      properties: {
        feedId: {
          type: 'string',
          format: 'uuid',
          description: 'A unique identifier associated with this feed.',
        },
        metric: {
          type: 'string',
          description:
            'A short description for the metric represented, e.g. Room temperature.',
        },
        meta: {
          type: 'object',
          description:
            'Metadata associated with the feed, such as the room number or floor.',
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
        feedId: 'eeaa50bb-fb5f-47be-a6ab-eb4c67debecb',
        metric: 'Room temperature',
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
            href: '/sensors/feed/eeaa50bb-fb5f-47be-a6ab-eb4c67debecb',
            rel: 'self',
          },
        ]),
      },
    },
  }

  @Get('/:id')
  @OnUndefined(404)
  @OpenAPI({
    summary: 'Request a single feed by its unique ID',
    description:
      'A single feed and its descendant timeseries will be returned.',
    responses: {
      200: {
        description: 'Successful request',
        schema: {
          $ref: '#/definitions/Feed',
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
          'Feed ID to retrieve description and associated set of timeseries for.',
        required: true,
        type: 'string',
        format: 'uuid',
      },
      ...sharedQueryParams,
    ],
  })
  async getOne(@Param('id') feedId: string, @Req() request?: any) {
    const feed = await Feed.getById(feedId)
    if (!feed) return
    return await feed.toFilteredJSON(null, 'both', {
      apiKey: getApiKey(request) as string,
    })
  }

  @Get('/:entity/:metric')
  @OnUndefined(404)
  @OpenAPI({
    summary: 'Request a single feed by the entity name and metric name',
    description:
      'A single feed and its descendant timeseries will be returned if one can be matched successfully. If developing code, we recommend using the UUID form for accessing feeds as this alleviates name changes.',
    responses: {
      200: {
        description: 'Successful request',
        schema: {
          $ref: '#/definitions/Feed',
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
        name: 'entity',
        description: 'Entity name under which to look for the metric.',
        required: true,
        type: 'string',
      },
      {
        in: 'path',
        name: 'metric',
        description:
          'Metric to retrieve description and associated set of timeseries for.',
        required: true,
        type: 'string',
      },
      ...sharedQueryParams,
    ],
  })
  async getOneFromFriendlyNames(
    @Param('entity') entity: string,
    @Param('metric') metric: string,
    @Req() request?: any
  ) {
    const feed = await Feed.getByFriendlyNames(entity, metric)
    if (!feed) return
    return await feed.toFilteredJSON(null, 'both', {
      apiKey: getApiKey(request) as string,
    })
  }
}
