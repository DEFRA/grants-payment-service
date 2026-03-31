import {
  postTestQueueMessageController,
  postTestGrantPaymentController,
  getTestGrantPaymentController,
  getTestPaymentsBySbiController,
  postTestProcessPaymentsController,
  getTestDailyPaymentsController,
  getTestGrantPaymentsBySbiAndGrantCodeController,
  postTestPopulateGrantPaymentController
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
          path: '/api/test/queue-message/{queueName?}',
          ...postTestQueueMessageController
        },
        {
          method: 'POST',
          path: '/api/test/grant-payments',
          ...postTestGrantPaymentController
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
          path: '/api/test/process-payments/{date?}',
          ...postTestProcessPaymentsController
        },
        {
          method: 'GET',
          path: '/api/test/daily-payments/{date?}',
          ...getTestDailyPaymentsController
        },
        {
          method: 'POST',
          path: '/api/test/populate-grant-payments',
          ...postTestPopulateGrantPaymentController
        }
      ])
    }
  }
}

export { testEndpoints }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
