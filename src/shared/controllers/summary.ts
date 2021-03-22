import { JsonController, Get } from 'routing-controllers'
import { OpenAPI } from 'routing-controllers-openapi'

import { Platform, Sensor } from 'shared/types'

@JsonController('/summary')
export class SummaryController {
  static Definitions = {
    PlatformSummary: {
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
        sensor: {
          type: 'object',
          description:
            'A direct mapping of sensor IDs to their respective metrics, with all other data omitted.',
        },
      },
      example: {
        platformId: '970d26c6-37c3-49e4-b2f8-00db042ac3eb',
        name: 'Urban Sciences Building: Floor 2: Room 2.048 Zone 1',
        sensor: {
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
          $ref: '#/definitions/PlatformSummary',
        },
      },
    },
  })
  async getSummary() {
    return (await Platform.getIndex()).map(
      (platform: Platform) => ({
        platformId: platform.platformId,
        name: platform.name,
        sensor: platform.sensor.reduce((set: any, sensor: Sensor) => {
          set[sensor.sensorId] = sensor.propertyId
          return set
        }, {}),
      }),
      []
    )
  }
}
