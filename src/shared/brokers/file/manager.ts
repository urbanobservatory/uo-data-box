import { FileController, FileControllerOptions } from './controller'

export class File {
  static Controllers: { [key: string]: FileController } = {}

  public static async AddController(
    options: FileControllerOptions
  ): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      const controller = new FileController(options)
      const controllerName = controller.getName()
      if (controllerName !== undefined) {
        File.Controllers[controllerName] = controller
        resolve(controller)
      }
      // TODO: handle reject
      // reject(false)
    }).then((controller) => (<FileController>controller).connect())
  }
}
