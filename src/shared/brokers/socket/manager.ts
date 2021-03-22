import { SocketController, SocketControllerOptions } from './controller'

export class Socket {
  static Controllers: { [key: string]: SocketController } = {}

  public static async AddController(
    options: SocketControllerOptions
  ): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      const controller = new SocketController(options)
      const controllerName = controller.getName()
      if (controllerName !== undefined) {
        Socket.Controllers[controllerName] = controller
        resolve(controller)
      }
      // TODO: handle reject
      // reject(false)
    }).then((controller) => (<SocketController>controller).connect())
  }
}
