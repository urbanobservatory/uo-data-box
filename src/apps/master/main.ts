import { initialiseSQL } from "shared/drivers/sql";
import { AMQP } from "shared/services/amqp";
import { Config as AppConfig } from "shared/services/config";
import { events } from "shared/services/events";
import { log } from "shared/services/log";
import { Receiver, IncomingStream } from "shared/services/receiver";
import { Entity } from "shared/types";

AppConfig.addDefaults({
  broker_queue_store: "uo.master.store",
  broker_amqp_host: "localhost",
  broker_amqp_username: "store",
  broker_amqp_password: "--snipped--",
  broker_amqp_port: "5672",
  storage_transaction_frequency: "2000",
  storage_full_update_frequency: "1800",
  db_host: "localhost",
  db_user: "uo-admin",
  db_pass: "--snipped--",
  db_name: "uo",
  db_port: "5432",
});

let appShutdown = false;
events.on("app:end:*", () => (appShutdown = true));

(async function masterService() {
  initialiseSQL();

  log.info("Loading all existing entities for cache...");
  await Entity.getAll(true);
  log.info("Loading is complete.");

  const queueService = await AMQP({
    hostname: AppConfig.getValue("broker_amqp_host"),
    username: AppConfig.getValue("broker_amqp_username"),
    password: AppConfig.getValue("broker_amqp_password"),
    port: parseInt(AppConfig.getValue("broker_amqp_port"), 10),
  });

  queueService.consumeQueue(
    AppConfig.getValue("broker_queue_store"),
    async (message: any) => {
      if (appShutdown) {
        log.warn("Rejecting new data because shutdown is in progress.");
        return Promise.resolve();
      }
      const item: IncomingStream = JSON.parse(message.content.toString());
      return Receiver.consume(item).catch((err: Error) => {
        log.error("Otherwise uncaught error.");
        log.error(`  ${err.message}`);
        log.error(`  ${err.stack}`);
        process.kill(process.pid);
      });
    },
    true
  );
})();
