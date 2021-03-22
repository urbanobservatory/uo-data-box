import { JsonController, Get, InternalServerError } from 'routing-controllers'
import fetch from 'isomorphic-fetch'

import { roadLengths } from './extra'
import { log } from 'shared/services/log'
import { events } from 'shared/services/events'

@JsonController('/bandstand')
export class BandstandController {
  static outputInterval = 300
  static updateInterval = 300

  static timeseries = []
  static updateTimer: any = null

  static scheduleUpdate() {
    if (BandstandController.updateTimer) return
    const nextDiscovery = Math.ceil(
      Math.ceil(Date.now() / (BandstandController.updateInterval * 1000)) *
        BandstandController.updateInterval *
        1000 -
        Date.now()
    )
    log.verbose(
      'Will next update data for Bandstand logo in ' +
        Math.floor(nextDiscovery / 1000) +
        ' seconds.'
    )

    BandstandController.updateTimer = setTimeout(() => {
      BandstandController.updateTimer = null
      BandstandController.updateTimeseries()
    }, nextDiscovery)
  }

  @Get('/logo')
  async getLogo() {
    return {
      units: {
        'Average vehicle speed': {
          name: 'miles per hour',
          abbreviation: 'mph',
        },
        Humidity: {
          name: 'percentage relative humidity',
          abbreviation: '%rH',
        },
        Temperature: {
          name: 'degrees celsius',
          abbreviation: '°C',
        },
        'Average wind speed': {
          name: 'metres per second',
          abbreviation: 'm/s',
        },
        'Vehicle count': {
          name: 'total number of vehicles passing',
          abbreviation: '',
        },
        'Soil moisture': {
          name: 'percentage volumetric water content',
          abbreviation: '%VWC',
        },
        'Sound level': {
          name: 'decibel',
          abbreviation: 'dB',
        },
        'Energy consumption at Newcastle Helix': {
          name: 'kilowatts',
          abbreviation: 'kW',
        },
        NO2: {
          name: 'micrograms per cubic metre',
          abbreviation: 'µg/m3',
        },
        'Air pressure': {
          name: 'hectopascal',
          abbreviation: 'hPa',
        },
      },
      timeseries: BandstandController.timeseries,
    }
  }

  static async updateTimeseries() {
    log.verbose('Updating timeseries data for Bandstand logo...')

    const startTime =
      Math.floor(
        (Date.now() / 1000 - 24 * 60 * 60) / BandstandController.outputInterval
      ) * BandstandController.outputInterval
    const endTime =
      Math.floor(Date.now() / 1000 / BandstandController.outputInterval) *
      BandstandController.outputInterval
    const newTimeseries: any = {}

    for (
      let time = startTime;
      time < endTime;
      time += BandstandController.outputInterval
    ) {
      newTimeseries[time] = {
        timestamp: new Date(time * 1000),
        variables: {
          'Average vehicle speed': null,
          Humidity: null,
          Temperature: null,
          'Average wind speed': null,
          // 'Car park occupancy': null,
          'Soil moisture': null,
          'Sound level': null,
          'Energy consumption at Newcastle Helix': null,
          NO2: null,
          'Vehicle count': null,
          'Air pressure': null,
        },
      }
    }

    try {
      await Promise.all([
        BandstandController.processUOTimeseries(newTimeseries),
        BandstandController.processUSBTimeseries(newTimeseries), //,
        // BandstandController.processUOV2Timeseries(newTimeseries)
      ])

      this.timeseries = Object.values(newTimeseries)
    } catch (e) {
      log.warn('One or more failures while obtaining Bandstand logo data.')
    }

    this.scheduleUpdate()
  }

  static async processUOTimeseries(timeseries: any): Promise<any> {
    const timeWindows: number[] =
      Object.keys(timeseries)
        .map((t) => parseInt(t))
        .sort() || []
    const lowTime = new Date(timeWindows[0] * 1000)
    const highTime = new Date((timeWindows.slice(-1).pop() || 0 + 3600) * 1000)
    const startTime = lowTime
      .toISOString()
      .replace(/[^0-9]/g, '')
      .match(/[0-9]{12}/)![0]

    const endTime = highTime
      .toISOString()
      .replace(/[^0-9]/g, '')
      .match(/[0-9]{12}/)![0]
    const variableMap: { [key: string]: string } = {
      'Journey Time': 'Average vehicle speed',
      Humidity: 'Humidity',
      Temperature: 'Temperature',
      'Wind Speed': 'Average wind speed',
      'Soil Moisture': 'Soil moisture',
      Sound: 'Sound level',
      NO2: 'NO2',
      'Traffic Flow': 'Vehicle count',
      Pressure: 'Air pressure',
    }
    const variables = Object.keys(variableMap)
    const boundingBox = [
      -1.67303,
      54.987076,
      -1.595785,
      54.954176,
      /*
      -1.640999,
      54.984533,
      -1.584726,
      54.964641*/
    ]

    const uoRequest = await fetch(
      `https://api.newcastle.urbanobservatory.ac.uk/api/v1/sensors/data/raw.json&start_time=${startTime}&end_time=${endTime}&variable=${variables.join(
        '-and-'
      )}&bbox=${boundingBox.join(',')}`
    )

    if (!uoRequest.ok) {
      throw new InternalServerError(
        'Unable to obtain timeseries data from Urban Observatory API.'
      )
    }

    const uoTimeseries = await uoRequest.json()
    const buckets = variables.reduce((set: any, variable: string) => {
      set[variable] = timeWindows.reduce((ts: any, timeUnix: number) => {
        ts[timeUnix] = []
        return ts
      }, {})
      return set
    }, {})

    uoTimeseries.forEach((ts: any) => {
      Object.keys(ts.data).forEach((variable: string) => {
        const variableSeries = ts.data[variable].data
        Object.keys(variableSeries).forEach((timestamp: string) => {
          const time = new Date(timestamp.replace(/ /, 'T') + 'Z')
          const timeBucket =
            Math.floor(
              time.getTime() / 1000 / BandstandController.outputInterval
            ) * BandstandController.outputInterval
          const targetBucket = buckets[variable][timeBucket]
          if (!targetBucket) return

          if (variable === 'Journey Time') {
            // Convert distance to miles, then convert to mph
            if (!roadLengths[ts.name] || variableSeries[timestamp] === 0.0)
              return
            targetBucket.push(
              ((roadLengths[ts.name] / 1000) * 0.621371) /
                (variableSeries[timestamp] / 3600)
            )
          } else if (variable === 'Wind Speed') {
            // Air Monitors devices like to report 216m/s if there's no weather inputs...
            if (variableSeries[timestamp] < 100.0) {
              targetBucket.push(variableSeries[timestamp])
            }
          } else {
            targetBucket.push(variableSeries[timestamp])
          }
        })
      })
    })

    Object.keys(buckets).forEach((variable: string) => {
      const bucket = buckets[variable]
      Object.keys(bucket).forEach((timestamp: string) => {
        const valueSet = bucket[timestamp]
        // Don't use mean for vehicle counts, give a total
        const meanValue =
          variable === 'Traffic Flow'
            ? valueSet.reduce((s: number, v: number) => s + v, 0)
            : valueSet.reduce((s: number, v: number) => s + v, 0) /
              valueSet.length
        timeseries[timestamp].variables[variableMap[variable]] = parseFloat(
          meanValue.toFixed(2)
        )
      })
    })
  }

  static async processUSBTimeseries(timeseries: any): Promise<any> {
    const usbTimeseries = [
      '15852caa-f089-4efd-be6b-549be8e7e7f4',
      'cf32814c-5961-4bc0-a25d-9a59cb11824d',
    ]

    const uoRequests = await Promise.all(
      usbTimeseries.map((t: string) =>
        fetch(
          `https://api.usb.urbanobservatory.ac.uk/api/v2.0a/sensors/timeseries/${t}/historic`
        )
      )
    )

    const timeWindows: number[] = Object.keys(timeseries)
      .map((t) => parseInt(t))
      .sort()
    const energyBuckets = [0, 1].reduce((set: any, variable: number) => {
      set[variable] = timeWindows.reduce((ts: any, timeUnix: number) => {
        ts[timeUnix] = []
        return ts
      }, {})
      return set
    }, {})

    await Promise.all(
      uoRequests.map(async (r, idx: number) => {
        if (!r.ok) {
          throw new InternalServerError(
            'Unable to obtain timeseries data from Urban Sciences Building API.'
          )
        }

        const response = await r.json()
        const timeseries = response.historic.values

        timeseries.forEach((entry: any) => {
          const time = new Date(entry.time)
          const timeBucket =
            Math.floor(
              time.getTime() / 1000 / BandstandController.outputInterval
            ) * BandstandController.outputInterval
          const targetBucket = energyBuckets[idx][timeBucket]
          if (!targetBucket) return

          targetBucket.push(entry.value)
        })
      })
    )

    Object.keys(energyBuckets).forEach((idx: string) => {
      const bucket = energyBuckets[idx]
      Object.keys(bucket).forEach((timestamp: string) => {
        const valueSet = bucket[timestamp]
        const meanValue =
          valueSet.reduce((s: number, v: number) => s + v, 0) / valueSet.length
        if (
          !timeseries[timestamp].variables[
            'Energy consumption at Newcastle Helix'
          ]
        ) {
          timeseries[timestamp].variables[
            'Energy consumption at Newcastle Helix'
          ] = 0.0
        }
        timeseries[timestamp].variables[
          'Energy consumption at Newcastle Helix'
        ] = parseFloat(
          (
            timeseries[timestamp].variables[
              'Energy consumption at Newcastle Helix'
            ] + meanValue
          ).toFixed(2)
        )
      })
    })
  }

  static async processUOV2Timeseries(timeseries: any): Promise<any> {
    const uoTimeseries = [
      'da5c401f-0f26-4b5a-9f13-78f0158606b8',
      '4e4ba445-3de2-4b5a-a09c-2326159bbd37',
      '6d78321a-4ad8-4963-9c9e-3da3518aefc8',
      '75d7388d-ed4f-4745-9727-14092d661162',
      'ebcc4cff-9e63-4c7a-a40d-6e9d3d4b3c2a',
      '3fea7bd6-a6ca-41c9-8e5b-c363b9f0f3aa',
      'de8555a3-c775-4861-b772-638caccbaa49',
      '67d0f443-3cbe-4d9d-bef1-3b0ac24fd797',
      'aa19c956-e6a4-4aed-aa03-ef657493e81a',
      'da9c8ee4-c1e5-4068-8d45-d0568e85920d',
      '561451ff-be15-4a46-b67c-93fe11efb216',
      '095a3ba5-a142-4706-bbb8-7a8718bdcdad',
      '710fb351-b2fa-4f3f-91be-08b307e32e9d',
      'cab3dbd1-bbcc-4f13-a5ae-f3680db62cea',
      'e9e5448c-92ae-42be-aa66-652026c31831',
      'a10bbeb4-f296-468e-9208-ce99f29da645',
    ]

    const uoRequests = []
    for (const t in uoTimeseries) {
      uoRequests.push(
        await fetch(
          `https://api.newcastle.urbanobservatory.ac.uk/api/v2.0a/sensors/timeseries/${uoTimeseries[t]}/historic`
        ).catch((e: Error) => {
          log.warn(`Unable to query timeseries '${t}' for logo`)
        })
      )
    }

    const timeWindows: number[] = Object.keys(timeseries)
      .map((t) => parseInt(t))
      .sort()
    const apiBuckets = [...uoTimeseries.keys()].reduce(
      (set: any, variable: number) => {
        set[variable] = timeWindows.reduce((ts: any, timeUnix: number) => {
          ts[timeUnix] = []
          return ts
        }, {})
        return set
      },
      {}
    )

    await Promise.all(
      uoRequests.map(async (r, idx: number) => {
        if (r) {
          if (!r.ok)
            throw new InternalServerError(
              'Unable to obtain timeseries data from Urban Observatory API V2.'
            )
          const response = await r.json()
          const timeseries = response.historic.values

          timeseries.forEach((entry: any) => {
            const time = new Date(entry.time)
            const timeBucket =
              Math.floor(
                time.getTime() / 1000 / BandstandController.outputInterval
              ) * BandstandController.outputInterval
            const targetBucket = apiBuckets[idx][timeBucket]
            if (!targetBucket) return

            targetBucket.push(entry.value)
          })
        }
      })
    )

    Object.keys(apiBuckets).forEach((idx: string) => {
      const bucket = apiBuckets[idx]
      Object.keys(bucket).forEach((timestamp: string) => {
        const valueSet = bucket[timestamp]
        if (!valueSet.length) return
        const meanValue =
          (valueSet.reduce((s: number, v: number) => s + v, 0) || 0) /
          (valueSet.length || 1)
        if (!timeseries[timestamp].variables['Car park occupancy']) {
          timeseries[timestamp].variables['Car park occupancy'] = 0.0
        }
        timeseries[timestamp].variables['Car park occupancy'] = parseFloat(
          (
            timeseries[timestamp].variables['Car park occupancy'] + meanValue
          ).toFixed(0)
        )
      })
    })
  }
}

// Schedule the first update
events.on('app:end:*', () => {
  if (!BandstandController.updateTimer) return
  log.info(
    `Received app termination notification. Will cancel further API updates.`
  )
  clearTimeout(BandstandController.updateTimer)
  BandstandController.updateTimer = null
})
BandstandController.updateTimeseries()
