import { getTestDailyPaymentsController } from '#~/routes/test-endpoints/controllers/get-test-daily-payments.controller.js'
import { postTestProcessPaymentsController } from '#~/routes/test-endpoints/controllers/post-test-process-payments.controller.js'

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
