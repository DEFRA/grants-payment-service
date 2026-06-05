import {
  postTestQueueMessageController,
  postTestGrantPaymentController,
  getTestGrantPaymentController,
  getTestPaymentsBySbiController,
  postTestProcessPaymentsController,
  postTestProcessPaymentsBySbiController,
  getTestDailyPaymentsController,
  postTestPopulateGrantPaymentController,
  deleteTestPaymentsBySbiController,
  postSyncDbIndexesController
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
          path: '/grant-payments/{sbi}/{fundCode?}',
          ...getTestPaymentsBySbiController
        },
        {
          method: 'DELETE',
          path: '/grant-payments/{sbi}/{fundCode?}',
          ...deleteTestPaymentsBySbiController
        },
        {
          method: 'POST',
          path: '/process-payments/{date?}',
          ...postTestProcessPaymentsController
        },
        {
          method: 'POST',
          path: '/process-payments-by-sbi/{sbi}',
          ...postTestProcessPaymentsBySbiController
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
        },
        {
          method: 'POST',
          path: '/sync-db-indexes',
          ...postSyncDbIndexesController
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
