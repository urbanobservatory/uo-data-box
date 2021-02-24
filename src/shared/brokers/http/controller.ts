import { HTTPInstance } from "./instance";
import { v4 as uuidv4 } from "uuid";

import { log, HTTPServer } from "shared/services";
import { Controller, ControllerOptions } from "../controller";

export interface HTTPControllerOptions extends ControllerOptions {
  address: string;
  protocol: string;
  port: number;
  processing: HTTPRequestOptions;
  name?: string;
  username?: string;
  password?: string;
  getMetadata?: (objectData: any) => { [key: string]: any };
  getRequestOptions?: (objectData: any) => { [key: string]: any };
}

// const HTTPControlleDefaults: HTTPControllerOptions = {
//   address: "localhost",
//   port: 80,
//   contentLength: 90000000000,
//   uploadDir: "/public",
// };

export interface HTTPRequestOptions {
  method?: string;
  contentLength?: number;
  path: (uniqueId?: string) => string;
  allowedIds?: string[];
  username?: string;
  password?: string;
  uploadFilename?: (a: any, b: string) => string;
}

export class HTTPController extends Controller {
  protected classType: string = "HTTP";
  protected options: HTTPControllerOptions;
  private instances: { [key: string]: HTTPInstance } = {};

  private instance: HTTPInstance;
  protected server: any = null;
  protected creating: boolean = false;
  protected connected: boolean = false;
  protected disconnecting: boolean = false;

  constructor(options: HTTPControllerOptions) {
    super();
    this.options = options;
  }

  public getOptions(): HTTPControllerOptions {
    return this.options;
  }

  public getMetadata() {
    return {
      protocol: "Raw TCP/IP",
    };
  }

  public getRequestOptions() {
    return {
      contentLength: this.options.processing.contentLength || 90000000000,
    };
  }

  // No discovery cycle is necessary for Http connections
  protected startDiscovery() {}
  protected endDiscovery() {}

  protected startAcquisition() {
    log.info(`Starting listening on HTTP for ${this.options.name}...`);
    this.listen();
  }

  protected endAcquisition() {
    if (this.server) {
      this.server.close();
    }
  }

  public async listen(): Promise<any> {
    if (this.creating) return;

    if (this.server) {
      this.destroy().then(() => this.startAcquisition());
      return;
    }

    this.creating = true;

    this.server = new HTTPServer({
      port: this.options.port,
      handleRequest: this.handleRequest,
      controller: this,
      username: this.options.username,
      password: this.options.password,
    });
    this.creating = false;
    await this.server.startListening();
    this.connected = true;
  }

  public async disconnect(): Promise<any> {
    if (!this.connected || !this.server) {
      return Promise.resolve();
    }

    return new Promise((resolve: Function, reject: Function) => {
      this.endDiscovery();
      this.endAcquisition();
      this.disconnecting = true;
      log.info(`Stopped listening on HTTP for ${this.options.name}...`);
      this.server = null;
      resolve();
    });
  }

  public async handleRequest(
    request: any,
    response: any,
    body: any,
    controller: HTTPController
  ) {
    // TODO: add proper responses
    // request.url == controller.options.processing.path
    if (request.method === controller.options.processing.method) {
      const newInstanceKey = uuidv4();
      controller.instances[newInstanceKey] = new HTTPInstance({
        connection: controller,
        instanceKey: newInstanceKey,
      });
      controller.instances[newInstanceKey].handlePost(request, response, body);
      //respond with created
      // TODO: better error handling
      response.setHeader("Content-Type", "application/json");
      response.statusCode = 202;
      body.end();
    } else {
      response.setHeader("Content-Type", "application/json");
      response.statusCode = 404;
      body.end();
    }
  }
}
