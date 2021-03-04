import { HTTPController, HTTPControllerOptions } from './controller'

export class HTTP {
  static Controllers: { [key: string]: HTTPController } = {}

  public static async AddController(
    options: HTTPControllerOptions
  ): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      const controller = new HTTPController(options)
      const controllerName = controller.getName()
      if (controllerName !== undefined) {
        HTTP.Controllers[controllerName] = controller
        resolve(controller)
      }
      // TODO: handle reject
      // reject(false)
    }).then((controller) => (<HTTPController>controller).listen())
  }
}
