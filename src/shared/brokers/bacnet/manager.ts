import { BACNETController, BACNETControllerOptions } from './controller'

export class BACNET {
  static PendingControllers: BACNETController[] = []
  static Controllers: { [key: string]: BACNETController } = {}

  public static async AddController(
    options: BACNETControllerOptions
  ): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      const controller = new BACNETController(options)
      BACNET.PendingControllers.push(controller)
      return controller.connect().then(() => {
        // TODO: handle reject
        const controllerName = controller.getName()
        if (controllerName !== undefined) {
          BACNET.Controllers[controllerName] = controller
          const pendingIndex = BACNET.PendingControllers.indexOf(controller)
          if (pendingIndex >= 0) {
            BACNET.PendingControllers.splice(pendingIndex, 1)
          }
          resolve(controller)
        }
        // TODO: handle reject
        // reject(false)
      })
    })
  }
}
