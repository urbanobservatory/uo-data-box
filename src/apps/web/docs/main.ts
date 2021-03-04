// Auto-generate a Swagger file, with some additional hard-coded stuff thrown in
import { generateOpenAPI } from '../api/openapi'
import { universalDefinitions } from 'shared/controllers/common'
import { universalTags } from '../api/tags'
import { routingOptions } from '../api/routing'

generateOpenAPI(routingOptions, {
  tags: universalTags,
  definitions: routingOptions().controllers.reduce(
    (set: any, controller: any) => ({ ...set, ...controller.Definitions }),
    universalDefinitions
  ),
})
process.exit(0)
