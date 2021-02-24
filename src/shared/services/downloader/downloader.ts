import * as fs from 'fs';
import * as request from 'request';
import * as path from 'path';

import {log} from 'shared/services/log';
import {MutexQueue} from 'shared/services/mutex-queue';

// Cheap and nasty way of allowing two concurrent downloads at a time...
const downloadQueue: MutexQueue[] = [
  new MutexQueue(),
  new MutexQueue()
];
let downloadQueueId = 0;

export class Downloader {
  public downloadFile(source: string, target: string) {
    downloadQueueId = downloadQueueId + 1;
    if (downloadQueueId >= downloadQueue.length) {
      downloadQueueId = 0;
    }
    return downloadQueue[downloadQueueId].addQueue((requeue: Function) => new Promise(
      (resolve: Function, reject: Function) => {
        log.debug(`Downloading file from ${source}...`);
        const httpHandler = (error: Error, response: any, data: any) => {
          if (error || !response || !data || response.statusCode.toString().indexOf('2') !== 0) {
            log.warn(`Error during HTTP request.`);
            log.warn(`  ${(error || {message: 'Unknown'}).message}`);
            log.debug(`  ${(error || {stack: ''}).stack}`);
            reject(error);
            return;
          }
          this.assertChain(path.dirname(`/archive/${target}`)).then(() => {
            fs.writeFile(`/archive/${target}`, data, 'binary', (err) => {
              if (err) {
                reject(err);
                return;
              }
              log.verbose(`Completed downloading ${source}.`);
              resolve(true);
            });
          });
        };

        request({
          url: source,
          timeout: 1500,
          encoding: null
        }, httpHandler);
      }
    ).catch((error: Error) => {
      log.warn(`Error during remote file download.`);
      log.warn(`  URL: ${source}`);
      log.warn(`  ${error.message}`);
      log.debug(`  ${error.stack}`);  
      throw error;
    }));
  }

  private async assertChain(path, mask: number = 0o777) {
    const components = path.split('/');
    let prefix = '';

    for (let i = 0; i < components.length; i++) {
      prefix += `${components[i]}/`;
      await this.assertDirectory(prefix, mask);
    }
  }

  private assertDirectory(path: string, mask: number = 0o777, position: number = 0): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      fs.mkdir(path, mask, function(err) {
        if (err) {
          if (err.code == 'EEXIST') {
            resolve(null);
          } else {
            reject(err);
          }
        } else {
          resolve();
        }
      });
    });
  }
}

