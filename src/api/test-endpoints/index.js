import {
  postTestCreateGrantPaymentController,
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
        postTestCreateGrantPaymentController,
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
