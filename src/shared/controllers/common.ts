import {Request} from 'express';

export const sharedQueryParams = [];

export const getApiKey = (request: Request) => {
  // TODO: Allow this to be passed as a query parameter or a bearer token etc.
  return request.query['apiKey'] || null;
};

export const universalDefinitions = {
  Pagination: {
    type: 'object',
    description: 'The pagination associated with the response, and data concerning the total number of items and pages.',
    properties: {
      pageNumber: {
        type: 'number',
        description: 'Index of the page returned by the request.'
      },
      pageSize: {
        type: 'number',
        description: 'Number of items per page to be returned.'
      },
      pageCount: {
        type: 'number',
        description: 'Total number of pages available.'
      },
      total: {
        type: 'number',
        description: 'Total number of items available, after any filtering has been applied.'
      }
    },
    example: {
      pageNumber: 1,
      pageSize: 10,
      pageCount: 1,
      total: 1
    }
  },
  BadRequest: {
    type: 'object',
    description: 'An invalid ID or query parameter was used to request information, such as an ID not in the [UUID syntax](https://en.wikipedia.org/wiki/Universally_unique_identifier).',
    properties: {
      error: {
        type: 'boolean',
        description: 'Indicator that an error was returned.'
      },
      message: {
        type: 'string',
        description: 'Description of the error which occurred in friendly terms.'
      },
      code: {
        type: 'string',
        description: 'A short description of the error, for use in code.',
        enum: [
          'MalformedUUID',
          'BadRequestError'
        ]
      }
    },
    example: {
      error: true,
      message: 'Malformed UUID cannot be used.',
      code: 'MalformedUUID'
    }
  },
  Forbidden: {
    type: 'object',
    description: 'The requested data could not be returned, because permissions do not permit.',
    properties: {
      error: {
        type: 'boolean',
        description: 'Indicator that an error was returned.'
      },
      message: {
        type: 'string',
        description: 'Description of the error which occurred in friendly terms.'
      },
      code: {
        type: 'string',
        description: 'A short description of the error, for use in code.',
        enum: [
          'ForbiddenError'
        ]
      }
    },
    example: {
      error: true,
      message: 'No access to this timeseries.',
      code: 'ForbiddenError'
    }
  },
  Link: {
    type: 'object',
    description: 'A link provided for [HATEOAS](https://en.wikipedia.org/wiki/HATEOAS) purposes, to the item itself or an associated API method.',
    properties: {
      rel: {
        type: 'string',
        description: 'The relation of the URL to the entity in the API, which will be taken from [this list](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types) where possible, but non-standard relations are permitted.'
      },
      href: {
        type: 'string',
        description: 'An absolute URL for the resource.'
      },
      method: {
        type: 'string',
        description: 'The HTTP protocol method to be used, or `GET` if not specified.',
        default: 'GET',
        enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
      }
    },
    example: {
      rel: 'self',
      href: '/sensors/timeseries/371fbff8-f61d-4f66-99be-7d9de8ad51f2/historic'
    }
  },
  Organisation: {
    type: 'object',
    description: 'An organisation which is providing the data to the Urban Observatory, or responsible for some element.',
    properties: {
      organisationId: {
        type: 'string',
        format: 'uuid',
        description: 'A unique identifier associated with the organisation.'
      },
      name: {
        type: 'string',
        description: 'The name of the organisation, which may be a subsidiary of the legal entity, e.g. Urban Observatory.'
      },
      url: {
        type: 'string',
        description: 'A URL for the organisation\'s web page.'
      },
      privateSector: {
        type: 'boolean',
        description: 'Indication of whether the organisation is public or private sector.'
      }
    },
    example: {
      organisationId: '2567c616-43f3-4b6b-930b-126ba9ad51c8',
      name: 'Urban Observatory',
      url: 'http://www.urbanobservatory.ac.uk/',
      privateSector: false
    }
  },
  Contact: {
    type: 'object',
    description: 'The contact for more information, or technical issues relating to the sensing. This may not always be available.',
    properties: {
      contactId: {
        type: 'string',
        format: 'uuid',
        description: 'A unique identifier associated with the contact.'
      },
      name: {
        type: 'string',
        description: 'An individual\'s name, or an indication of shared contact details'
      },
      email: {
        type: 'string',
        description: 'An email address to contact.'
      },
      phone: {
        type: 'string',
        description: 'A telephone number to use, which may not always be available.'
      }
    },
    example: {
      contactId: '19c2aabb-33d0-47f1-a4f5-3fbfe3c7bcf0',
      name: 'Urban Observatory',
      email: 'urbanobservatory@ncl.ac.uk',
      phone: '0191 208 8599'
    }
  },
  Licence: {
    type: 'object',
    description: '',
    properties: {
      licenceId: {
        type: 'string',
        format: 'uuid',
        description: 'A unique identifier associated with the licence.'
      },
      name: {
        type: 'string',
        description: 'The name for the licence, e.g. Open Government Licence v3.'
      },
      url: {
        type: 'string',
        description: 'A URL for the licence, or where more information can be obtained, such as the procedure for approval to use the data.'
      },
      description: {
        type: 'object',
        description: 'A data-based description of the licence, such as the constraints which may be in place, e.g. `open: false`.'
      }
    },
    example: {
      licenceId: '1629fceb-799b-4840-8f5b-8b8612b374c9',
      name: 'Urban Observatory: Ethical approval required',
      url: 'http://www.urbanobservatory.ac.uk/',
      description: {
        open: false
      }
    }
  },
  Storage: {
    type: 'object',
    description: 'The storage mechanism used to hold the data internally.',
    properties: {
      unitId: {
        type: 'string',
        format: 'uuid',
        description: 'A unique identifier for the storage used for this data within the internal systems.'
      },
      name: {
        type: 'string',
        description: 'A name for the storage, usually those used in programming (e.g. real, integer)'
      },
      suffix: {
        type: 'string',
        description: 'The suffix used for data storage in the internal systems.'
      }
    },
    example: {
      storageId: 3,
      name: 'Real',
      suffix: 'real'
    }
  },
  Unit: {
    type: 'object',
    description: 'The units associated with the values held in the timeseries.',
    properties: {
      unitId: {
        type: 'string',
        format: 'uuid',
        description: 'A unique identifier for the units associated with timeseries.'
      },
      name: {
        type: 'string',
        description: 'A friendly description for the units used.'
      }
    },
    example: {
      unitId: '19bc95ba-83f2-4dcd-b49e-5e5415c75771',
      name: 'amperes'
    }
  }
};
