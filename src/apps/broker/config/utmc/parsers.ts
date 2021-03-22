export function utmcToKey(instance: any) {
  return instance.systemCodeNumber
}

const vaisalaTimes: any = {}

export function utmcUpdated(c1: any, c2: any) {
  if (
    (!c1 || !c1.dynamics || !c1.dynamics.length) &&
    c2 &&
    c2.dynamics &&
    c2.dynamics.length
  ) {
    return true
  }

  for (let i = 0; i < c1.dynamics.length; i++) {
    if (
      !c2 ||
      !c2.dynamics ||
      !c2.dynamics[i] ||
      c1.dynamics[i].lastUpdated !== c2.dynamics[i].lastUpdated
    ) {
      try {
        const systemCode = c2.systemCodeNumber || 'UNKNOWN'
        const oldUpdated = new Date(
          vaisalaTimes[systemCode] || c1.dynamics[i].lastUpdated
        )
        const newUpdated = new Date(c2.dynamics[i].lastUpdated)
        const timeInterval =
          Math.abs(newUpdated.getTime() - oldUpdated.getTime()) / 1000
        if (
          systemCode.indexOf('VAISALA') < 0 &&
          systemCode.indexOf('METCCTV') < 0
        ) {
          return true
        } else {
          if (timeInterval < 550 && vaisalaTimes[systemCode]) return false
          vaisalaTimes[systemCode] = newUpdated.toISOString()
          return true
        }
      } catch (e) {
        console.log(e)
        return true
      }
    }
  }

  return false
}

// ---
//  CCTV
// ---

interface CameraInstance {
  systemCodeNumber: string
  definitions: {
    shortDescription: string
    longDescription: string
    point: {
      easting: number
      northing: number
    }
    lastUpdated: Date
  }[]
}

interface CameraDynamicInstance {
  systemCodeNumber: string
  dynamics: {
    image: string
    lastUpdated: string
  }[]
}
/**
 *
 * @param {CameraDynamicInstance} camera
 * @param {sting} imagePath
 *
 * @returns {sting}
 */
export function cameraImageFilename(
  camera: CameraDynamicInstance,
  imagePath: string
) {
  const imageTime: Date = new Date(camera.dynamics[0].lastUpdated)
  const timeFull = imageTime
    .toISOString()
    .replace(/T/, '_')
    .replace(/([-:]|\.[0-9Z]+$)/g, '')
  const dateString = timeFull.split('_')[0]
  const timeString = timeFull.split('_')[1]
  return `public/camera-feeds/${camera.systemCodeNumber}/${dateString}/${timeString}.jpg`
}
/**
 *
 * @param instanceData
 */
export function getCameraMetadata(instanceData: {
  staticData: any
  dynamicData: any
}) {
  const { staticData, dynamicData } = instanceData
  const systemDefinition =
    (staticData.definitions || []).slice(0, 1).pop() || {}
  const dynamicDefinition = (dynamicData.dynamics || []).slice(0, 1).pop() || {}
  if (!systemDefinition.longDescription) return null

  const cameraArea = systemDefinition.longDescription.replace(/ - (.*)$/, '')
  const cameraPositions = systemDefinition.longDescription
    .replace(/^[^-]+ - /, '')
    .split(' / ')

  return {
    broker: {},
    brokerage: {},
    platform: {
      area: cameraArea,
      lookingAt: cameraPositions,
    },
    metric: {},
    platformName: `Camera mounted at ${systemDefinition.longDescription}`,
    metricName: 'Camera image',
    unit: 'JPEG Image',
    targetType: 'File',
    valueSource: 'fileURL',
    valueTime: new Date(dynamicDefinition.lastUpdated).toISOString(),
  }
}

// ---
//  Car parks
// ---
export function getCarParkMetadata(instanceData: {
  staticData: any
  dynamicData: any
}) {
  const { staticData, dynamicData } = instanceData
  const systemDefinition =
    (staticData.definitions || []).slice(0, 1).pop() || {}
  const systemConfiguration =
    (staticData.configurations || []).slice(0, 1).pop() || {}
  const dynamicDefinition = (dynamicData.dynamics || []).slice(0, 1).pop() || {}
  if (!systemDefinition.longDescription) return null

  // Only include car parks with monitoring
  if (
    ['SPACES', 'ALMOST FULL', 'FULL'].indexOf(
      dynamicDefinition.stateDescription
    ) < 0
  )
    return null

  return {
    broker: {},
    brokerage: {},
    platform: {
      name: systemDefinition.shortDescription,
      address: systemDefinition.longDescription,
    },
    metric: {
      totalSpaces: systemConfiguration.capacity,
    },
    platformName: `Car park at ${systemDefinition.shortDescription}`,
    metricName: 'Occupied spaces',
    unit: 'Spaces',
    targetType: 'Integer',
    valueSource: 'occupancy',
    value: dynamicDefinition.occupancy,
    valueTime: new Date(dynamicDefinition.lastUpdated).toISOString(),
  }
}

// ---
//  Journey time links
// ---
function journeyTimePairBase(systemDefinition: any, dynamicDefinition: any) {
  return {
    broker: {},
    brokerage: {},
    platform: {
      shortName: systemDefinition.shortDescription,
      longName: systemDefinition.longDescription,
      startEasting: systemDefinition.point.easting,
      startNorthing: systemDefinition.point.northing,
      endEasting: systemDefinition.endPoint.easting,
      endNorthing: systemDefinition.endPoint.northing,
    },
    metric: {},
    platformName: `Vehicle monitoring pair ${systemDefinition.shortDescription}`,
    valueTime: new Date(dynamicDefinition.lastUpdated).toISOString(),
  }
}

function journeyTimeWrangler(instanceData: any) {
  const { staticData, dynamicData } = instanceData
  const systemDefinition =
    (staticData.definitions || []).slice(0, 1).pop() || {}
  const systemConfiguration =
    (staticData.configurations || []).slice(0, 1).pop() || {}
  const dynamicDefinition = (dynamicData.dynamics || []).slice(0, 1).pop() || {}
  if (!systemDefinition.longDescription) return null

  return {
    systemDefinition,
    systemConfiguration,
    dynamicDefinition,
  }
}

export function getJourneyTimeMetadata(instanceData: {
  staticData: any
  dynamicData: any
}) {
  const definitions = journeyTimeWrangler(instanceData)

  const systemDefinition = definitions ? definitions.systemDefinition : null
  const dynamicDefinition = definitions ? definitions.dynamicDefinition : null
  return {
    ...journeyTimePairBase(systemDefinition, dynamicDefinition),

    metricName: 'Journey time',
    unit: 'Seconds',
    targetType: 'Real',
    valueSource: 'linkTravelTime',
    value: dynamicDefinition.linkTravelTime,
  }
}

export function getJourneyTimePlatesIn(instanceData: {
  staticData: any
  dynamicData: any
}) {
  const definitions = journeyTimeWrangler(instanceData)

  const systemDefinition = definitions ? definitions.systemDefinition : null
  const dynamicDefinition = definitions ? definitions.dynamicDefinition : null

  return {
    ...journeyTimePairBase(systemDefinition, dynamicDefinition),

    metricName: 'Number plates at start of link',
    unit: 'Count',
    targetType: 'Integer',
    valueSource: 'platesIn',
    value: dynamicDefinition.platesIn,
  }
}

export function getJourneyTimePlatesOut(instanceData: {
  staticData: any
  dynamicData: any
}) {
  const definitions = journeyTimeWrangler(instanceData)

  const systemDefinition = definitions ? definitions.systemDefinition : null
  const dynamicDefinition = definitions ? definitions.dynamicDefinition : null

  return {
    ...journeyTimePairBase(systemDefinition, dynamicDefinition),

    metricName: 'Number plates at end of link',
    unit: 'Count',
    targetType: 'Integer',
    valueSource: 'platesOut',
    value: dynamicDefinition.platesOut,
  }
}

export function getJourneyTimePlateMatches(instanceData: {
  staticData: any
  dynamicData: any
}) {
  const definitions = journeyTimeWrangler(instanceData)

  const systemDefinition = definitions ? definitions.systemDefinition : null
  const dynamicDefinition = definitions ? definitions.dynamicDefinition : null
  return {
    ...journeyTimePairBase(systemDefinition, dynamicDefinition),

    metricName: 'Number plates matched for journey time',
    unit: 'Count',
    targetType: 'Integer',
    valueSource: 'plateMatches',
    value: dynamicDefinition.plateMatches,
  }
}
