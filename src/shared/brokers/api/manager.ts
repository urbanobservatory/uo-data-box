import { APIController, APIControllerOptions } from './controller'

export class API {
  static Controllers: { [key: string]: APIController } = {}

  public static async AddController(
    options: APIControllerOptions
  ): Promise<APIController> {
    return new Promise((resolve: Function, reject: Function) => {
      const controller = new APIController(options)
      const controllerName = controller.getName()
      if (controllerName !== undefined) {
        API.Controllers[controllerName] = controller
        resolve(controller)
      }
      // TODO: handle reject
      // reject(false)
    }).then((controller) => (<APIController>controller).connect())
  }
}
