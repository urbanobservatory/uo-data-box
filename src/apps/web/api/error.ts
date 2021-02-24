import {Middleware, ExpressErrorMiddlewareInterface} from 'routing-controllers';

import {log} from 'shared/services/log';

@Middleware({ type: 'after' })
export class GenericErrorHandler implements ExpressErrorMiddlewareInterface {
  error(error: any, request: any, response: any, next: (err?: any) => any) {
    // Perhaps there's some useful information in the error object...
    if (error && error.routine) {
      if (error.routine === 'string_to_uuid') {
        response.status(400).json({
          error: true,
          message: 'Malformed UUID cannot be used.',
          code: 'MalformedUUID'
        });
        next();
        return;
      }
    }

    if (error.message && error.message.indexOf('query timeout') >= 0) {
      response.status(413).json({
        error: true,
        message: 'Unable to provide data within a sensible timeframe. Try requesting less data.',
        code: 'QueryTimeout'
      });
      return;
    }

    if (error.httpCode) {
      response.status(error.httpCode).json({
        error: true,
        message: error.message,
        code: error.name
      });
      return;
    }

    response.status(500).json({
      error: true,
      message: 'Internal server error',
      code: 'InternalError'
    });
    log.warn('Encountered error processing API request.');
    log.warn(`  URI: ${request.uri}`);
    log.warn(`  ${error.message}`);
    log.debug(error);
    log.debug(`  ${error.stack}`);
    next();
  }
}
