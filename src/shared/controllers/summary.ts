import { JsonController, Get } from 'routing-controllers'
import { OpenAPI } from 'routing-controllers-openapi'

import { Entity, Feed } from 'shared/types'

@JsonController('/sensors/summary')
export class SummaryController {
  static Definitions = {
    EntitySummary: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'A unique identifier associated with this entity.',
        },
        name: {
          type: 'string',
          description:
            'Friendly name associated with the entity, not used internally.',
        },
        feed: {
          type: 'object',
          description:
            'A direct mapping of feed IDs to their respective metrics, with all other data omitted.',
        },
      },
      example: {
        entityId: '970d26c6-37c3-49e4-b2f8-00db042ac3eb',
        name: 'Urban Sciences Building: Floor 2: Room 2.048 Zone 1',
        feed: {
          '87b2d34e-b96e-44c1-ae69-374f4bac02cd': 'Room Temperature',
        },
      },
    },
  }

  @Get()
  @OpenAPI({
    summary: 'List all entities in summary form',
    description:
      'Non-paginated list of all entities, with only basic information provided.',
    deprecated: true,
    responses: {
      200: {
        description: 'Successful request',
        schema: {
          $ref: '#/definitions/EntitySummary',
        },
      },
    },
  })
  async getSummary() {
    return (await Entity.getIndex()).map(
      (entity: Entity) => ({
        entityId: entity.entityId,
        name: entity.name,
        feed: entity.feed.reduce((set: any, feed: Feed) => {
          set[feed.feedId] = feed.metric
          return set
        }, {}),
      }),
      []
    )
  }
}
