import {
  postTestCreateGrantPaymentController,
  getTestGrantPaymentController,
  getTestPaymentsBySbiController,
  postTestProcessPaymentsController,
  getTestDailyPaymentsController,
  getTestGrantPaymentsBySbiAndGrantCodeController
} from './controllers/index.js'

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
const testEndpoints = {
  plugin: {
    name: 'testEndpoints',
    register: (server) => {
      server.route([
        {
          method: 'POST',
          path: '/api/test/grant-payments',
          ...postTestCreateGrantPaymentController
        },
        {
          method: 'GET',
          path: '/api/test/grant-payments',
          ...getTestGrantPaymentController
        },
        {
          method: 'GET',
          path: '/api/test/grant-payments/{sbi}',
          ...getTestPaymentsBySbiController
        },
        {
          method: 'GET',
          path: '/api/test/grant-payments/{sbi}/{grantCode}',
          ...getTestGrantPaymentsBySbiAndGrantCodeController
        },
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
