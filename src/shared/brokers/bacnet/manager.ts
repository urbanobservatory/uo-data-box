import {BACNETController, BACNETControllerOptions} from './controller';

export class BACNET {
  static PendingControllers: BACNETController[] = [];
  static Controllers: {[key: string]: BACNETController} = {};

  public static async AddController(options: BACNETControllerOptions): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      const controller = new BACNETController(options);
      BACNET.PendingControllers.push(controller);
      return controller.connect().then(
        () => {
          BACNET.Controllers[controller.getName()] = controller;   
          const pendingIndex = BACNET.PendingControllers.indexOf(controller);
          if (pendingIndex >= 0) {
            BACNET.PendingControllers.splice(pendingIndex, 1);
          }
          resolve(controller);
        }
      );
    });
  }
}
