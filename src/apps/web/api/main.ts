// Required for routing controllers to work properly
import "reflect-metadata";

import { Request, Response } from "express";
import { createExpressServer } from "routing-controllers";

import { log, Config as AppConfig, initialiseHATEOAS } from "shared/services";
import { initialiseSQL } from "shared/drivers/sql";

import { initialiseUpdaters } from "./latest";
import { routingOptions, hateoasOptions } from "./routing";

log.info("API application is starting...");

AppConfig.addDefaults({
  db_host: "localhost",
  db_port: "5432",
  db_user: "uo-admin",
  db_pass: "--removed--",
  db_name: "uo",
  api_base: "https://api.usb.urbanobservatory.ac.uk/api/",
});

initialiseSQL();
initialiseUpdaters();
initialiseHATEOAS(hateoasOptions);

(async function apiService() {
  // This is all very temporary until we implement routing controllers
  // and fancy decorators for the API :-)
  const app = createExpressServer(routingOptions());
  app.listen(3001);

  app.use((request: Request, response: Response, next: any) => {
    // Status code could already have been sent, in which case
    // we can't override it so fail silently in that case.
    try {
      response.status(404).send({
        error: true,
        message: "Invalid route.",
        code: "NotFound",
      });
      log.verbose(`No route found for '${request.originalUrl}'. Sending 404.`);
    } catch (e) {}
    next();
  });
})();
