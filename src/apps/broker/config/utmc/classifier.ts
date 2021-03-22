import * as child_process from 'child_process'
import * as fs from 'fs'

import { log } from 'shared/services/log'
import { MutexQueue } from 'shared/services/mutex-queue'

interface Classification {
  views: number
  time: number
  error?: boolean
}

const pendingClassifications: { [id: string]: boolean } = {}
const lastClassifications: { [id: string]: Classification } = loadFromCacheFile(
  'image-classifier.json'
)
const overrideClassifications: { [id: string]: number } = {
  UO_NGATE02: 1,
  UO_GRYST01: 1,
  GH_B1288A1: 3,
  NC_B6324A2: 3,
  NB_A193A3: 3,
  ST_A194B4: 2,
  SL_A690E2: 2,
  GH_A167F1: 1,
  GH_CBSA1: 4,
  NB_A1061A1: 3,
  NB_A1068B1: 3,
  NB_A189A1: 3,
  NB_A189A2: 3,
  NB_A192A1: 1,
  NB_A193B1: 4,
  NB_A6079A1: 2,
  NC_A167B1: 1,
  NT_A188A3: 4,
  NT_A189B1: 2,
  NT_A191A1: 4,
  NT_A191C1: 3,
  NT_A191D1: 4,
  NT_A191E1: 1, // In a bag, currently broken, so cannot train
  NT_A193C1: 2,
  NT_A191G1: 3,
  SL_A1231D2: 4,
  SL_B1405A1: 4,
  ST_A183A1: 2,
  ST_A184H1: 2,
  ST_A185A1: 3,
  ST_A185B1: 2,
  ST_A194D1: 3,
  ST_B1344A1: 3,
  ST_A1290C1: 3,
  MCJ05141: 2,
  PS193: 4,
  PS194: 3,
  SL_HLRA1: 3,
  SL_A183A2: 3,
  SL_B1522B1: 2,
  SL_B1522C1: 4,
}
const disableClassifications: any[] = [
  /^TT2/,
  /^VAISALA/,
  /^METCCTV/,
  /^(NT_A191A1|NB_A1068B1|NB_A1061A1|NB_A189A1)$/, // Broken classifiers, despite training
]

const trainingQueue: MutexQueue = new MutexQueue()

function loadFromCacheFile(fn: string) {
  let cache: any = {}
  try {
    const fileContents = fs.readFileSync(`./cache/${fn}`)
    if (fileContents) {
      cache = JSON.parse(fileContents.toString())

      // Don't load in cached errors, to force a rerun of training
      Object.keys(cache).forEach((k) => {
        if (cache[k].error) {
          delete cache[k]
        }
      })
    }
  } catch (e) {
    log.warn('Unable to load cache file for image classifier.')
    log.warn(`  ${e.message}`)
  }
  return cache
}

export async function classifyImage(amqpPayload: any) {
  const sourceId = amqpPayload.brokerage.id
  let feedMetric = amqpPayload.feed.metric

  return new Promise((resolve: Function, reject: Function) => {
    // Are classifications disabled for this ID?
    if (disableClassifications.find((test: any) => test.test(sourceId))) {
      resolve({ ...amqpPayload })
      return
    }

    // Have we never run the training? Or is it invalid?
    if (!lastClassifications[sourceId]) {
      trainImage(sourceId)
      resolve({ ...amqpPayload })
      return
    }

    // Have the overrides changed?
    if (
      lastClassifications[sourceId] &&
      overrideClassifications[sourceId] &&
      overrideClassifications[sourceId] !== lastClassifications[sourceId].views
    ) {
      trainImage(sourceId)
      resolve({ ...amqpPayload })
      return
    }

    // Has the training expired?
    // TODO: Decide the basis for retraining, but only once classes are rematched

    // Have we on record that this camera only has one view?
    if (lastClassifications[sourceId].views === 1) {
      resolve({ ...amqpPayload })
      return
    }

    const imageFile = `/archive/${amqpPayload.timeseries.value.data}`
    const trainingFile = `./cache/${sourceId}_CLASS.knn`
    child_process.exec(
      `python3 "/data/cam2views/classify_view.py" -i ${imageFile} -m ${trainingFile}`,
      null,
      (
        error: Error | null,
        stdout: string | Buffer,
        stderr: string | Buffer
      ) => {
        if (error) {
          log.warn(`Error during image classification for '${sourceId}'`)
          log.warn(`  ${error.message}`)
          log.debug(error.stack as string)

          // File not found on the training file means we need to run it again
          if (
            error.message.indexOf('FileNotFound') >= 0 &&
            error.message.indexOf('_CLASS.knn') >= 0
          ) {
            delete lastClassifications[sourceId]
            log.warn(`Training will be rescheduled for '${sourceId}'`)
          }

          resolve({ ...amqpPayload })
          return
        }

        const assignedClass = parseInt(stdout as string, 10)
        if (isNaN(assignedClass)) {
          log.warn(`Invalid classification returned for '${sourceId}'`)
          log.warn(`  ${(stdout as string).trim()}`)
          resolve({ ...amqpPayload })
          return
        }

        // Create a new metric using the view :-)
        const viewSuffix = ('0' + (assignedClass + 1)).substr(-2)
        feedMetric += `: View ${viewSuffix}`

        resolve({
          ...amqpPayload,
          brokerage: {
            ...amqpPayload.brokerage,
            id: `${sourceId}:V${viewSuffix}`,
          },
          feed: {
            ...amqpPayload.feed,
            metric: feedMetric,
            meta: {
              ...(amqpPayload.feed.meta || {}),
              viewId: assignedClass,
            },
          },
        })
      }
    )
  })
}

export function trainImage(sourceId: string) {
  // Is it sitting in the queue already?
  if (pendingClassifications[sourceId]) {
    return false
  }

  trainingQueue.addQueue(() =>
    new Promise((resolve: Function, reject: Function) => {
      log.info(`Running image training for '${sourceId}'...`)

      // Take the last 3 days by default, excluding today :-)
      const trainingDates = [
        new Date(),
        new Date(),
        new Date(),
        new Date(),
      ].map((d: Date, idx: number) => {
        d.setDate(d.getDate() - idx - 1)
        return (
          ('0000' + d.getFullYear()).substr(-4) +
          ('0' + (d.getMonth() + 1)).substr(-2) +
          ('0' + d.getDate()).substr(-2)
        )
      })
      const trainingFile = `./cache/${sourceId}_CLASS.knn`
      const trainingSources = trainingDates
        .map((d: string) => `/archive/public/camera-feeds/${sourceId}/${d}/`)
        .filter((d: string) => fs.existsSync(d))
        .filter((d: string) => fs.readdirSync(d).length > 200)
      const knownClusters = overrideClassifications[sourceId] || 0

      if (!trainingSources.length) {
        log.warn(`Insufficient data to train '${sourceId}'.`)
        delete pendingClassifications[sourceId]
        resolve()
        return
      }

      child_process.exec(
        `python3 "/data/cam2views/create_views_classifier.py" -m ${trainingFile} ` +
          `-i ${trainingSources.join(' ')}${
            knownClusters ? ` -c ${knownClusters}` : ''
          }`,
        null,
        (
          error: Error | null,
          stdout: string | Buffer,
          stderr: string | Buffer
        ) => {
          let assignedCount = knownClusters || parseInt(stdout as string, 10)
          let assignmentError = false

          if (error) {
            log.warn('Error during image classification')
            log.warn(`  ${error.message}`)
            log.debug(error.stack as string)

            assignedCount = 1
            assignmentError = true
          }

          if (isNaN(assignedCount)) {
            log.warn('Invalid training returned')
            log.warn(`  ${stdout}`)
            log.warn(`  ${stderr}`)

            assignedCount = 1
            assignmentError = true
          }

          delete pendingClassifications[sourceId]
          lastClassifications[sourceId] = {
            time: Date.now(),
            views: assignedCount,
            error: assignmentError,
          }
          fs.writeFileSync(
            './cache/image-classifier.json',
            JSON.stringify(lastClassifications, null, 2)
          )
          log.info(`Successfully completed image training for '${sourceId}'.`)
          resolve()
        }
      )
    }).catch((e: Error) => {
      log.warn(`Training error: ${e.message}`)
    })
  )
  return true
}
