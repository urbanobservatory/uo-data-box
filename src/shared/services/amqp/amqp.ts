import * as ampqLib from "amqplib";
import * as Bluebird from "bluebird";

import { events, log } from "shared/services";

interface AMQPOptions {
  hostname: string;
  username: string;
  password: string;
  port?: number;
  disabled?: boolean;
}

interface AMQPExchangeRoute {
  name: string;
  routingKey?: string;
}

interface AMQPQueue {
  handler: (any) => Promise<any> | void;
  async: boolean;
}

export class AMQPConnection {
  protected options: AMQPOptions;
  private connected: boolean = false;
  private connecting: boolean = false;
  private disconnecting: boolean = false;
  private shutdown: boolean = false;
  private connection: any = null;
  private channel: any = null;
  private assertedQueues: { [key: string]: boolean } = {};
  private consumedQueues: { [key: string]: AMQPQueue[] } = {};

  constructor(options: AMQPOptions) {
    this.options = options;
    events.on("app:end:*", () => {
      this.shutdown = true;
      if (!this.connection) return;
      log.info(
        `Received app termination notification. Should disconnect from AMQP...`
      );
      if (!this.disconnecting) this.disconnect();
    });
  }

  public async connect() {
    const { hostname, username, password, port, disabled } = this.options;

    if (disabled) {
      log.warn(`All AMQP services have been disabled.`);
      return this;
    }

    if (this.connecting || this.connected) {
      log.warn(
        "Cannot connect to AMQP while existing connection or attempt in place."
      );
      return this;
    }
    this.connecting = true;

    try {
      if (this.channel) {
        log.info(`Attempting to close AQMP channel.`);
        this.channel.close();
      }
      this.channel = null;
    } catch (alreadyClosed) {
      this.channel = null;
      log.warn(`AQMP channel already closed.`);
      log.warn(alreadyClosed.stackAtStateChange);
    }

    log.info(`Attempting to connect to AMQP queue...`);
    log.info(`  Server: ${hostname}:${port || 5672}`);
    try {
      this.connection = await ampqLib.connect(
        `amqp://${username}:${password}@${hostname}${port ? `:${port}` : ""}`
      );
      this.channel = await this.connection.createChannel();
    } catch (e) {
      log.error(`Failed to connect to AMQP queue.`);
      log.error(`  ${e.message}`);
      log.debug(e.stack);
      if (!this.disconnecting) this.disconnect();
      if (!this.shutdown) setTimeout(() => this.connect(), 2500);
      return this;
    }
    this.channel.on("close", () => {
      log.info(`Channel was closed to AQMP.`);
      // this.channel = null
      if (this.connecting) return;
      if (!this.disconnecting) this.disconnect();
    });
    this.channel.on("error", (e: any) => {
      log.warn(
        `Error occured on the AQMP channel. Will attempt to reconnect...`
      );
      log.verbose(`  ${e.message}`);
      log.warn(` Stack: ${e.stack}`);
      log.warn(` Stack at: ${e.stackAtStateChange}`);
      log.debug(` Error code: ${e.code}`);
      if (this.connecting) return;
      if (!this.disconnecting) this.disconnect();
      if (!this.shutdown) setTimeout(() => this.connect(), 2500);
    });

    this.connection.on("close", () => {
      log.info(`Connection was closed to AQMP.`);
      if (this.connecting) return;
      if (!this.disconnecting) this.disconnect();
      if (!this.shutdown) setTimeout(() => this.connect(), 2500);
    });
    this.connection.on("error", (e: any) => {
      log.warn(
        `Error occured on the AQMP connection. Will attempt to reconnect...`
      );
      log.verbose(`  ${e.message}`);
      if (!this.disconnecting) this.disconnect();
      if (!this.shutdown) this.connect();
    });
    log.info(`Now connected to AMQP queue.`);
    this.connected = true;
    this.disconnecting = false;
    this.connecting = false;
    this.assertedQueues = {};
    this.resume();
    return this;
  }

  public disconnect() {
    this.disconnecting = true;
    try {
      if (this.channel) {
        log.info(`Attempting to close AQMP channel.`);
        this.channel.close();
      }
    } catch (alreadyClosed) {
      this.channel = null;
      log.warn(`AQMP channel already closed.`);
      log.warn(alreadyClosed.stackAtStateChange);
    }
    this.channel = null;
    try {
      if (this.connection) {
        log.info(`Attempting to disconnect from AQMP queue.`);
        this.connection.close();
      }
    } catch (error) {
      log.warn(`Failed to disconnect from AQMP queue.`);
      log.warn(`  ${error.message}`);
      log.debug(`  ${error.stack}`);
    }
    this.connected = false;
    this.disconnecting = false;
    this.connecting = false;
    this.connection = null;
    log.verbose("Disconnected from AMQP.");
  }

  public resume() {
    Object.keys(this.consumedQueues).forEach((queueName: string) => {
      this.consumedQueues[queueName].forEach((queue: AMQPQueue) => {
        this.consumeQueueSetup(queueName, queue.handler, queue.async);
      });
    });
  }

  public async assertQueue(queueName: string) {
    if (this.assertedQueues[queueName]) return true;
    try {
      await this.channel.assertQueue(queueName);
      this.assertedQueues[queueName] = true;
      return true;
    } catch (e) {
      this.assertedQueues[queueName] = false;
      return false;
    }
  }

  public async sendToQueue(queueName: string, queueData: any) {
    if (!this.connected || this.disconnecting || !this.channel) {
      if (this.options.disabled) return;
      throw new Error(
        "Cannot send data to queue because connection is closed or closing."
      );
    }
    if (!(await this.assertQueue(queueName))) {
      throw new Error(
        "Attempted to submit data to an AMQP queue which does not exist."
      );
    }

    try {
      const status = await this.channel.sendToQueue(
        queueName,
        Buffer.from(queueData)
      );
    } catch (e) {
      log.error("Unable to send to queue");
      log.verbose(`  ${e.message}`);
    }

    return status;
  }

  public async sendToExchange(exchange: AMQPExchangeRoute, exchangeData: any) {
    if (!this.connected || this.disconnecting) {
      if (this.options.disabled) return;
      throw new Error(
        "Cannot send data to exchange because connection is closed or closing."
      );
    }
    return await this.channel.publish(
      exchange.name,
      exchange.routingKey || "",
      Buffer.from(JSON.stringify(exchangeData))
    );
  }

  public consumeQueue(
    queueName: string,
    handler: (any) => Promise<any> | void,
    async?: boolean
  ) {
    if (!this.consumedQueues[queueName]) {
      this.consumedQueues[queueName] = [];
    }
    this.consumedQueues[queueName].push({
      handler,
      async,
    });
    this.consumeQueueSetup(queueName, handler, async);
  }

  public consumeQueueSetup(
    queueName,
    handler: (any) => Promise<any> | void,
    async?: boolean
  ) {
    if (!this.channel) return;
    this.channel.prefetch(10);
    this.channel.consume(queueName, (message: any) => {
      if (message === null) return;
      if (async) {
        const receipt: Promise<any> = <any>handler(message);
        receipt.then((response: any) => {
          if (response === false) {
            log.debug(
              "Sending negative acknowledgement as consumption was rejected."
            );
            this.channel.nack(message); // Requeue is default
            return;
          }
          this.channel.ack(message);
        });
      } else {
        this.channel.ack(message);
        handler(message);
      }
    });
  }
}

let instance: AMQPConnection = null;
export const AMQP = async (options?: AMQPOptions) => {
  if (!instance && options) {
    instance = new AMQPConnection(options);
    return instance.connect();
  }
  return Promise.resolve(instance);
};
