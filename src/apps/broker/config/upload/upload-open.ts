import { HTTP } from 'shared/brokers'
import { Config as AppConfig } from 'shared/services/config'
import { cameraImageFilename, getCameraMetadata, cameraIds } from './parsers'

// get API creds from env
const apiCredentials = {
  username: AppConfig.getValue('broker_configuration_username'),
  password: AppConfig.getValue('broker_configuration_password'),
}

export const OpenServices = {
  requiredServices: () => [
    HTTP.AddController({
      address: 'localhost',
      port: 80,
      ...apiCredentials,
      getMetadata: getCameraMetadata,
      protocol: 'HTTP',
      name: 'Urban Observatory File Upload Service',
      processing: {
        method: 'POST',
        path: () => '/',
        uploadFilename: cameraImageFilename,
        allowedIds: cameraIds,
      },
    }),
  ],
}
