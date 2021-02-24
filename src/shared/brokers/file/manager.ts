import {FileController, FileControllerOptions} from './controller';

export class File {
  static Controllers: {[key: string]: FileController} = {};

  public static async AddController(options: FileControllerOptions): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      const controller = new FileController(options);
      File.Controllers[controller.getName()] = controller;
      resolve(controller);
    }).then((controller: FileController) => controller.connect());
  }
}
