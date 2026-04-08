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
          path: '/queue-message/{queueName?}',
          ...postTestQueueMessageController
        },
        {
          method: 'POST',
          path: '/grant-payments',
          ...postTestGrantPaymentController
        },
        {
          method: 'GET',
          path: '/grant-payments',
          ...getTestGrantPaymentController
        },
        {
          method: 'GET',
          path: '/grant-payments/{sbi}',
          ...getTestPaymentsBySbiController
        },
        {
          method: 'GET',
          path: '/grant-payments/{sbi}/{grantCode}',
          ...getTestGrantPaymentsBySbiAndGrantCodeController
        },
        {
          method: 'POST',
          path: '/process-payments/{date?}',
          ...postTestProcessPaymentsController
        },
        {
          method: 'GET',
          path: '/daily-payments/{date?}',
          ...getTestDailyPaymentsController
        },
        {
          method: 'POST',
          path: '/populate-grant-payments',
          ...postTestPopulateGrantPaymentController
        }
      ])
    }
  },
  routes: { prefix: '/api/test' }
}

export { testEndpoints }

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
