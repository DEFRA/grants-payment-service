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

const options = {
  compression: {
    gzip: {
      minBytes: 1024
    },
    deflate: {
      minBytes: 1024
    }
  }
}

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
          options,
          ...postTestQueueMessageController
        },
        {
          method: 'POST',
          path: '/api/test/grant-payments',
          options,
          ...postTestGrantPaymentController
        },
        {
          method: 'GET',
          path: '/api/test/grant-payments',
          options,
          ...getTestGrantPaymentController
        },
        {
          method: 'GET',
          path: '/api/test/grant-payments/{sbi}',
          options,
          ...getTestPaymentsBySbiController
        },
        {
          method: 'GET',
          path: '/api/test/grant-payments/{sbi}/{grantCode}',
          options,
          ...getTestGrantPaymentsBySbiAndGrantCodeController
        },
        {
          method: 'POST',
          path: '/api/test/process-payments/{date?}',
          options,
          ...postTestProcessPaymentsController
        },
        {
          method: 'GET',
          path: '/api/test/daily-payments/{date?}',
          options,
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
