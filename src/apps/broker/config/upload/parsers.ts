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
 * Utility function for creating image public filePath
 * @param {string} cameraId
 * @param {string} imagePath
 *
 * @returns {string}
 */
export function cameraImageFilename(
  cameraId: string,
  imagePath: string
): string {
  const imageTime: Date = new Date()
  const timeFull = imageTime
    .toISOString()
    .replace(/T/, '_')
    .replace(/([-:]|\.[0-9Z]+$)/g, '')
  const dateString = timeFull.split('_')[0]
  const timeString = timeFull.split('_')[1]
  return `public/camera-feeds/${cameraId}/${dateString}/${timeString}.${getImageExtension(
    imagePath
  )}`
}

// export function getCameraMetadata(instanceData: {
//   staticData: any;
//   dynamicData: any;
// }) {
export function getCameraMetadata() {
  // const { staticData, dynamicData } = instanceData;
  // const systemDefinition =
  //   (staticData.definitions || []).slice(0, 1).pop() || {};
  // const dynamicDefinition =
  //   (dynamicData.dynamics || []).slice(0, 1).pop() || {};
  // if (!systemDefinition.longDescription) return null;

  // const cameraArea = systemDefinition.longDescription.replace(/ - (.*)$/, "");
  // const cameraPositions = systemDefinition.longDescription
  //   .replace(/^[^-]+ - /, "")
  //   .split(" / ");

  return {
    broker: {},
    brokerage: {},
    platform: {
      area: 'Newcastle',
      lookingAt: ['Northumberland Street'],
      inDeployment: 'northumberland-street-almera-cameras',
    },
    metric: {},
    // platformName: `Camera mounted at ${systemDefinition.longDescription}`,
    platformName: 'Camera mounted at Commercial Union House',
    metricName: 'Camera image',
    unit: 'JPEG Image',
    targetType: 'File',
    valueSource: 'fileURL',
    valueTime: new Date().toISOString(),
  }
}

/**
 * Regex function for extracting extension from filename
 * @param {string} imagePath
 *
 * @returns {string}
 */
function getImageExtension(imagePath: string) {
  const extensionExtraction = /(?:\.([^.]+))?$/
  const extensions = extensionExtraction.exec(imagePath)
  return extensions === null ? 'jpg' : extensions[1]
}

// NOTE: LOOKUP TABLE for CAMERA ID's array if not reject / in the post key for the file we define
export const cameraIds = [
  'cuh-northumberland-street-1',
  'cuh-northumberland-street-2',
]
