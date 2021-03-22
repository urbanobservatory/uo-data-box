import { KNXController, KNXControllerOptions } from './controller'

export class KNX {
  static PendingControllers: KNXController[] = []
  static Controllers: { [key: string]: KNXController } = {}

  public static async AddController(
    options: KNXControllerOptions
  ): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      const controller = new KNXController(options)
      KNX.PendingControllers.push(controller)
      return controller.connect().then(() => {
        const controllerName = controller.getName()
        if (controllerName !== undefined) {
          KNX.Controllers[controllerName] = controller
          const pendingIndex = KNX.PendingControllers.indexOf(controller)
          if (pendingIndex >= 0) {
            KNX.PendingControllers.splice(pendingIndex, 1)
          }
          resolve(controller)
        }
        // TODO: handle reject
        // reject(false)
      })
    })
  }
}
