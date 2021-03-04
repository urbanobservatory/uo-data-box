import { API, APIAcquisitionBehaviour } from 'shared/brokers'
import { Config as AppConfig } from 'shared/services/config'

import {
  cameraImageFilename,
  getCameraMetadata,
  getCarParkMetadata,
  getJourneyTimeMetadata,
  getJourneyTimePlatesIn,
  getJourneyTimePlatesOut,
  getJourneyTimePlateMatches,
  utmcUpdated,
  utmcToKey,
} from './parsers'
import { classifyImage } from './classifier'

const apiCredentials = {
  username: AppConfig.getValue('broker_configuration_api_username'),
  password: AppConfig.getValue('broker_configuration_api_password'),
}

export const OpenFeeds = {
  requiredServices: () => [
    // CCTV images
    API.AddController({
      getMetadata: getCameraMetadata,
      protocol: 'HTTPS',
      discovery: {
        autoDiscovery: true,
        autoDiscoveryInterval: 3600000,
        path: () => '/api/v1/cctv/static',
        instanceToKey: utmcToKey,
        ...apiCredentials,
      },
      updateInterval: 20000,
      address: 'www.netraveldata.co.uk',
      name: 'UTMC Open Camera Feeds',
      acquisition: {
        path: () => `/api/v1/cctv/dynamic`,
        ...apiCredentials,
        behaviour: APIAcquisitionBehaviour.All,
        instanceToKey: utmcToKey,
        instanceComparator: utmcUpdated,
        autoDownloadImages: true,
        autoDownloadFilename: cameraImageFilename,
      },
      preSendHooks: [classifyImage],
    }),
    // Car park occupancy
    API.AddController({
      getMetadata: getCarParkMetadata,
      protocol: 'HTTPS',
      discovery: {
        autoDiscovery: true,
        autoDiscoveryInterval: 3600000,
        path: () => '/api/v1/carpark/static',
        instanceToKey: utmcToKey,
        ...apiCredentials,
      },
      updateInterval: 20000,
      address: 'www.netraveldata.co.uk',
      name: 'UTMC Open Car Park Feeds',
      acquisition: {
        path: () => `/api/v1/carpark/dynamic`,
        ...apiCredentials,
        behaviour: APIAcquisitionBehaviour.All,
        instanceToKey: utmcToKey,
        instanceComparator: utmcUpdated,
        autoDownloadImages: false,
      },
    }),
    // Journey time links
    API.AddController({
      getMetadata: getJourneyTimeMetadata,
      protocol: 'HTTPS',
      discovery: {
        autoDiscovery: true,
        autoDiscoveryInterval: 3600000,
        path: () => '/api/v2/journeytime/static',
        instanceToKey: (i) => `${utmcToKey(i)}:JourneyTime`,
        ...apiCredentials,
      },
      updateInterval: 20000,
      address: 'www.netraveldata.co.uk',
      name: 'UTMC Open Journey Time Feeds',
      acquisition: {
        path: () => `/api/v2/journeytime/dynamic`,
        ...apiCredentials,
        behaviour: APIAcquisitionBehaviour.All,
        instanceToKey: (i) => `${utmcToKey(i)}:JourneyTime`,
        instanceComparator: utmcUpdated,
        autoDownloadImages: false,
      },
    }),
    // Plates in
    API.AddController({
      getMetadata: getJourneyTimePlatesIn,
      protocol: 'HTTPS',
      discovery: {
        autoDiscovery: true,
        autoDiscoveryInterval: 3600000,
        path: () => '/api/v2/journeytime/static',
        instanceToKey: (i) => `${utmcToKey(i)}:PlatesIn`,
        ...apiCredentials,
      },
      updateInterval: 19000,
      address: 'www.netraveldata.co.uk',
      name: 'UTMC Open Journey Time Feeds',
      acquisition: {
        path: () => `/api/v2/journeytime/dynamic`,
        ...apiCredentials,
        behaviour: APIAcquisitionBehaviour.All,
        instanceToKey: (i) => `${utmcToKey(i)}:PlatesIn`,
        instanceComparator: utmcUpdated,
        autoDownloadImages: false,
      },
    }),
    // Plates out
    API.AddController({
      getMetadata: getJourneyTimePlatesOut,
      protocol: 'HTTPS',
      discovery: {
        autoDiscovery: true,
        autoDiscoveryInterval: 3600000,
        path: () => '/api/v2/journeytime/static',
        instanceToKey: (i) => `${utmcToKey(i)}:PlatesOut`,
        ...apiCredentials,
      },
      updateInterval: 22000,
      address: 'www.netraveldata.co.uk',
      name: 'UTMC Open Journey Time Feeds',
      acquisition: {
        path: () => `/api/v2/journeytime/dynamic`,
        ...apiCredentials,
        behaviour: APIAcquisitionBehaviour.All,
        instanceToKey: (i) => `${utmcToKey(i)}:PlatesOut`,
        instanceComparator: utmcUpdated,
        autoDownloadImages: false,
      },
    }),
    // Plate matches
    API.AddController({
      getMetadata: getJourneyTimePlateMatches,
      protocol: 'HTTPS',
      discovery: {
        autoDiscovery: true,
        autoDiscoveryInterval: 3600000,
        path: () => '/api/v2/journeytime/static',
        instanceToKey: (i) => `${utmcToKey(i)}:PlateMatches`,
        ...apiCredentials,
      },
      updateInterval: 21000,
      address: 'www.netraveldata.co.uk',
      name: 'UTMC Open Journey Time Feeds',
      acquisition: {
        path: () => `/api/v2/journeytime/dynamic`,
        ...apiCredentials,
        behaviour: APIAcquisitionBehaviour.All,
        instanceToKey: (i) => `${utmcToKey(i)}:PlateMatches`,
        instanceComparator: utmcUpdated,
        autoDownloadImages: false,
      },
    }),
  ],
}
