import { log } from 'shared/services/log'

export class MutexQueue {
  private queueCallbacks: (() => Promise<any>)[] = []
  private queueInFlight: boolean = false
  private queueLastBreak = 0

  public async addQueue(cb: (func: Function) => Promise<any>) {
    return new Promise((resolve: Function, reject: Function) => {
      const queueFunction = () => {
        return cb(() => {
          this.queueCallbacks.push(queueFunction)
          this.queueLastBreak++
          this.nextQueue()
        })
          .then((...args) => resolve(args))
          .catch((e: Error) => reject(e))
      }
      this.queueCallbacks.push(queueFunction)
      this.queueLastBreak++
      this.nextQueue()
    })
  }

  private nextQueue() {
    if (this.queueLastBreak > 20) {
      this.queueLastBreak = 0
      setTimeout(() => this.processQueue(), 0)
    } else {
      this.processQueue()
    }
  }

  private processQueue() {
    // Mutex this operation so only one at a time
    if (this.queueInFlight) return
    this.queueInFlight = true

    // Shouldn't really happen, but deal with empty queues
    if (!this.queueCallbacks.length) {
      this.queueInFlight = false
      log.debug('Queue execution suspended, as queue is now empty.')
      return
    }

    // Schedule the next operation, and the one after it
    const nextOp: (() => Promise<any>) | undefined = this.queueCallbacks
      .splice(0, 1)
      .pop()

    log.debug('Scheduling queued operation.')
    if (nextOp)
      nextOp()
        .then(() => {
          this.queueInFlight = false
          this.queueLastBreak++
          this.nextQueue()
        })
        .catch(() => {
          this.queueInFlight = false
          this.queueLastBreak++
          this.nextQueue()
        })
  }
}
