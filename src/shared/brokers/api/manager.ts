import {APIController, APIControllerOptions} from './controller';

export class API {
  static Controllers: {[key: string]: APIController} = {};

  public static async AddController(options: APIControllerOptions): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      const controller = new APIController(options);
      API.Controllers[controller.getName()] = controller;   
      resolve(controller);
    }).then((controller: APIController) => controller.connect());
  }
}
