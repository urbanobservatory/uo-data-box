import * as bootprint from 'bootprint';
import * as bootprintOpenAPI from 'bootprint-openapi';
import * as fs from 'fs';
import {getMetadataArgsStorage} from 'routing-controllers';
import {routingControllersToSpec} from 'routing-controllers-openapi';

import {log} from 'shared/services/log';

export function generateOpenAPI(controllerOptions: any, extraOptions: any) {
  log.info('Attempting to auto-gen documentation for API.');
  const storage = getMetadataArgsStorage();
  const specification = routingControllersToSpec(
    storage,
    controllerOptions,
    {
      // TODO: make this stuff configurable somewhere sensible
      info: {
        title: 'Urban Observatory API: Urban Sciences Building',
        description: 'The Urban Observatory represents the largest open platform of urban sensing data in the United Kingdom. The updated API is currently in operation for the Urban Sciences Building and some of the newer data sources across the city. It is anticipated that this schema, once complete, will replace the existing API.\n\n' +
          'For more information...\n' +
          '* [Data explorer](https://3d.usb.urbanobservatory.ac.uk/) \n' +
          '* [Live stream](https://api.usb.urbanobservatory.ac.uk/live/) \n' +
          '* [Newcastle University](https://www.ncl.ac.uk/) \n' +
          '* [Urban Observatory](http://www.urbanobservatory.ac.uk/) \n' +
          '\n' +
          'You can also download this specification in [OpenAPI](openapi.json) format.',
        termsOfService: '',
        contact: {
          name: 'Luke Smith',
          email: 'luke.smith@ncl.ac.uk',
          url: 'http://www.urbanobservatory.ac.uk/'
        },
        version: '2.0a'
      },
      host: 'api.usb.urbanobservatory.ac.uk',
      basePath: '/api/v2.0a',
      schemes: [
        'https'
      ],
      consumes: [
        'application/json'
      ],
      produces: [
        'application/json',
        'text/csv'
      ],
      ...extraOptions
    }
  );

  const specificationJSON = JSON
    .stringify(specification, null, 2)
    .replace(/"href": "\/sensors\//g, '"href": "https://api.usb.urbanobservatory.ac.uk/api/v2.0a/sensors/');

  fs.writeFileSync(
    './docs/openapi.json',
    specificationJSON
  );

  bootprint
    .load(bootprintOpenAPI)
    .build('./docs/openapi.json', './docs/bootprint')
    .generate()
    .done(() => {
      log.info('Successfully generated OpenAPI specification.');
    });
}
