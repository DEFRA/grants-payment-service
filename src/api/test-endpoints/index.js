import {
  postTestCreateGrantPaymentController,
  getTestGrantPaymentController,
  postTestProcessPaymentsController,
  getTestDailyPaymentsController
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
        {
          method: 'POST',
          path: '/test/process-payments/{date?}',
          ...postTestProcessPaymentsController
        },
        {
          method: 'GET',
          path: '/test/daily-payments/{date?}',
          ...getTestDailyPaymentsController
        }
      ])
    }
  }
}

export { testEndpoints }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
