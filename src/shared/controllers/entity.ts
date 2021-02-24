import {Response} from 'express';
import {JsonController, Get, Param, QueryParam, QueryParams, Req, OnUndefined} from 'routing-controllers';
import {OpenAPI} from 'routing-controllers-openapi';

import {Entity, Feed} from 'shared/types';

import {FeedController} from './feed';
import {getApiKey, sharedQueryParams} from './common';

@JsonController('/sensors/entity')
export class EntityController {

  static Definitions = {
    Entity: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'A unique identifier associated with this entity.'
        },
        name: {
          type: 'string',
          description: 'Friendly name associated with the entity, not used internally.'
        },
        meta: {
          type: 'object',
          description: 'Metadata associated with the entity, such as room numbers or building name.'
        },
        position: {
          type: 'array'
        },
        feed: {
          type: 'array',
          items: {
            '$ref': '#/definitions/Feed'
          }
        }
      },
      example: {
        entityId: 'e33f9ed0-cb60-4326-8ea6-4f166dd0c767',
        name: 'Urban Sciences Building: Floor 2: Room 2.048 Zone 1',
        meta: {
          building: 'Urban Sciences Building',
          roomZone: '1',
          roomNumber: '2.048',
          buildingFloor: '2'
        },
        position: [],
        feed: [FeedController.Definitions.Feed.example]
      }
    }
  };

  @Get()
  @OpenAPI({
    summary: 'List all entities (paginated)',
    description: 'Paginated list of all entities, including their associated feeds and timeseries.',
    responses: {
      200: {
        description: 'Successful request',
        schema: {
          type: 'object',
          properties: {
            pagination: {
              '$ref': '#/definitions/Pagination'
            },
            items: {
              type: 'array',
              items: {
                '$ref': '#/definitions/Entity'
              }
            }
          }
        }
      }
    },
    parameters: [
      {
        in: 'query',
        name: 'page',
        description: 'Page number to return results from, will default to `1` if omitted.',
        required: false,
        default: 1,
        type: 'number'
      }, {
        in: 'query',
        name: 'pageSize',
        description: 'Request a number of items per page, however the API may constrain the range.',
        required: false,
        default: 10,
        type: 'number'
      }, {
        in: 'query',
        name: 'meta:{key}={value}',
        description: 'Filter based on metadata, e.g. `meta:roomNumber=2.048`',
        required: false,
        type: 'any'
      }, {
        in: 'query',
        name: 'brokerage:sourceId={value}',
        description: 'Filter based on the ID at the source controller or broker, such as the BACNET ID within a building. This is especially useful if you have some prior knowledge of the systems, or are using the data in combination with related data sources. Note that source IDs are not required to confirm to any standard, other than the controller ID and source ID combined must be a unique pair.',
        required: false,
        type: 'string'
      }, {
        in: 'query',
        name: 'name',
        description: 'Filter to only include entities which partially match the name specified. Each word is considered to be additive and case insensitive, so phrases must be surrounded by double quotes. ' +
        'For example, to return only room 3.04, use `name="Room 3.04"`.',
        required: false,
        type: 'string'
      }, {
        in: 'query',
        name: 'metric',
        description: 'Filter to only include entities with, and feeds therein, matching at least one of the metrics specified. Partial matches on metrics are included, and each word is considered to be additive and case insensitive, so phrases must be surrounded by double quotes. ' +
        'For example, to return the occupancy and room temperature, but exclude flow temperatures, use `metric=occupied+"room temperature"`.',
        required: false,
        type: 'string'
      }
    ]
  })
  async getAll(
    @QueryParam('page') page: number,
    @QueryParam('pageSize') pageSize: number,
    @QueryParams() params: any,
    @Req() request?: any
  ) {
    const allEntities = await Entity.getPaginated(
      {
        pageNumber: page,
        pageSize
      },
      params
    );
    allEntities.items = await Promise.all(
      allEntities.items.map(async (entity: Entity) => await entity.toFilteredJSON(undefined, undefined, {
        // TODO: find better way
        apiKey: getApiKey(request) as string
      }))
    );
    return allEntities;
  }

  @Get('/:id')
  @OnUndefined(404)
  @OpenAPI({
    summary: 'Request a single entity by its unique ID',
    description: 'A single entity and its associated feeds will be returned, if a valid ID is supplied and permissions permit.',
    responses: {
      200: {
        description: 'Successful request',
        schema: {
          '$ref': '#/definitions/Entity'
        }
      },
      400: {
        description: 'Bad request',
        schema: {
          '$ref': '#/definitions/BadRequest'
        }
      }
    },
    parameters: [
      ...sharedQueryParams
    ]
  })
  async getOne(
    @Param('id') entityId: string,
    @Req() request?: any
  ) {
    const entity = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId) ?
      await Entity.getByFriendlyName(entityId) :
      await Entity.getById(entityId);
    if (!entity) return;
    return await entity.toFilteredJSON(undefined, undefined, {
      apiKey: getApiKey(request) as string
    });
  }
}
