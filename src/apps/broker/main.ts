import { arguments, AMQP, log, Config as AppConfig } from "shared/services";

import { Config } from "./config";

AppConfig.addDefaults({
  broker_exchange_cov: "uo.raw",
  broker_amqp_host: "localhost",
  broker_amqp_username: "broker",
  broker_amqp_password: "--removed--",
  file_cache_frequency: "60",
  minimum_cov_interval: "30",
});

log.info("Broker application is starting...");

log.verbose("Parsing command line options...");
const cliArguments = arguments
  .option({
    name: "configuration",
    short: "c",
    type: "string",
    description:
      "Specify the environment to provide brokerage for, separated by a dot, e.g. USB.Level2",
  })
  .option({
    name: "verbose",
    type: "boolean",
    description: "Output additional log messages",
  })
  .option({
    name: "debug",
    type: "boolean",
    description: "Output many log messages",
  })
  .run();

if (!cliArguments.options || !cliArguments.options.configuration) {
  log.error(`You must specify a valid configuration environment.`);
  process.exit(1);
}

log.verbose("Extracting required configuration...");
const configSelection = cliArguments.options.configuration.split(".");

let configSelectionElement: string = null;
let selectedConfig: any = Config;

while ((configSelectionElement = configSelection.shift())) {
  if (!selectedConfig[configSelectionElement]) {
    log.error(
      `The configuration element '${configSelectionElement}' does not exist.`
    );
    process.exit(1);
  } else {
    selectedConfig = selectedConfig[configSelectionElement];
  }
}

if (!selectedConfig || !selectedConfig.requiredServices) {
  log.error(`The configuration selected could not be loaded.`);
  process.exit(1);
}

log.verbose("Starting to load...");

(async function brokerService() {
  const queueService = await AMQP({
    hostname: AppConfig.getValue("broker_amqp_host"),
    port: parseInt(AppConfig.getValue("broker_amqp_port"), 10) || 5672,
    username: AppConfig.getValue("broker_amqp_username"),
    password: AppConfig.getValue("broker_amqp_password"),
    disabled: !!AppConfig.getValue("broker_amqp_disabled"),
  }).catch((e: Error) => {
    log.error(`Failed to connect to AMQP server...`);
    log.error(`  ${e.message}`);
    log.debug(`  ${e.stack}`);
    process.exit(1);
  });

  Promise.all(selectedConfig.requiredServices()).catch((e: Error) => {
    log.error(`Unhandled exception during application start...`);
    log.error(`  ${e.message}`);
    log.debug(`  ${e.stack}`);
  });
})();
