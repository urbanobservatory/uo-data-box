import {SocketController, SocketControllerOptions} from './controller';

export class Socket {
  static Controllers: {[key: string]: SocketController} = {};

  public static async AddController(options: SocketControllerOptions): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      const controller = new SocketController(options);
      Socket.Controllers[controller.getName()] = controller;
      resolve(controller);
    }).then((controller: SocketController) => controller.connect());
  }
}
