import { HTTPController, HTTPControllerOptions } from "./controller";

export class HTTP {
  static Controllers: { [key: string]: HTTPController } = {};

  public static async AddController(
    options: HTTPControllerOptions
  ): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      const controller = new HTTPController(options);
      HTTP.Controllers[controller.getName()] = controller;
      resolve(controller);
    }).then((controller: HTTPController) => controller.listen());
  }
}
