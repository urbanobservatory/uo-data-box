import * as fs from "fs";
import * as HTTP from "http";
import { events, log } from "shared/services";
import { pipeline, PassThrough } from "stream";

import { File } from "../types";

// basic-auth
import * as auth from "basic-auth";
import * as compare from "tsscmp";

// load encoding utils
import { getSupportedEncoderInfo } from "shared/services/http";
import { HTTPController } from "shared/brokers";

interface HTTPServerOptions {
  port: number;
  handleRequest: any;
  controller: HTTPController;
  username?: string;
  password?: string;
}

export class HTTPServer {
  private options: HTTPServerOptions;
  private listening: boolean = false;
  private instance: HTTP.Server;

  constructor(options: HTTPServerOptions) {
    this.options = options;
    this.addEventListeners();
  }

  private addEventListeners() {
    events.on("app:end:*", () => {
      if (!this.instance) return;
      log.info(
        `Received app termination notification. Should terminate Websocket connections...`
      );
      this.stopListening();
    });
  }

  public async startListening() {
    if (this.instance) {
      log.warn("HTTPServer already exists. Attempting to destroy first...");
      await this.stopListening();
    }
    return new Promise((resolve: Function, reject: Function) => {
      log.info(
        `Creating new HTTPServer server to listen on port ${
          this.options.port || 80
        }...`
      );

      this.instance = this.createHTTPServer(
        this.options.handleRequest,
        this.options.controller
      );

      // start server
      this.instance.listen({ port: 80, ...this.options });

      this.instance.on("listening", () => {
        this.listening = true;
        log.info(`HTTPServer running on port ${this.options.port}`);
        resolve();
      });
    });
  }

  public async stopListening() {
    log.info("Stopping HTTPServer server...");
    this.listening = false;
    this.instance.close();
    log.info("HTTPServer stopping completed.");
  }

  private createHTTPServer(
    callback: any,
    controller: HTTPController
  ): HTTP.Server {
    return HTTP.createServer((request, response) => {
      // Check credentials
      if (this.options.username && this.options.password) {
        const credentials = auth(request);
        if (!credentials || !this.check(credentials.name, credentials.pass)) {
          response.statusCode = 401;
          response.setHeader("WWW-Authenticate", 'Basic realm="UO"');
          response.end("Access denied");
          return;
        }
      }
      // check encoding
      const encoderInfo = getSupportedEncoderInfo(request);
      if (!encoderInfo) {
        // Encoded not supported by this server
        response.statusCode = 406;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: "Encodings not supported" }));
        return;
      }

      let body = response;
      response.setHeader("Content-Encoding", encoderInfo.name);
      // If encoding is not identity, encode the response =)
      if (!encoderInfo.isIdentity()) {
        const onError = (err: any) => {
          if (err) {
            // If an error occurs, there's not much we can do because
            // the server has already sent the 200 response code and
            // some amount of data has already been sent to the client.
            // The best we can do is terminate the response immediately
            // and log the error.
            response.end();
            log.error("An error occurred:", err);
          }
        };
        const stream = new PassThrough();
        pipeline(stream, encoderInfo.createEncoder(), response, onError);
      }
      // normal response callback
      callback(request, response, body, controller);
    });
  }

  // TODO: move to security utils
  private check(name, pass) {
    var valid = true;
    // Simple method to prevent short-circut and use timing-safe compare
    valid = compare(name, this.options.username) && valid;
    valid = compare(pass, this.options.password) && valid;

    return valid;
  }
}
