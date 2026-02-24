import {
  postTestGrantPaymentController,
  getTestGrantPaymentController,
  getTestPaymentsBySbiController
} from './controllers/index.js'

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const testEndpoints = {
  plugin: {
    name: 'testEndpoints',
    register: (server) => {
      server.route([
        postTestGrantPaymentController,
        getTestGrantPaymentController,
        getTestPaymentsBySbiController
      ])
    }
  }
}

export { testEndpoints }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
