import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { fetchAllGrantPayments } from '#~/common/helpers/fetch-all-grant-payments.js'

/**
 * Controller to get all grant payments in the database
 * @satisfies {Partial<ServerRoute>}
 */
const getTestGrantPaymentController = {
  options: {
    description: 'Fetch all grant-payments in the database',
    tags: ['api', 'test'],
    auth: false,
    timeout: {
      server: false,
      socket: false
    }
  },
  handler: async (req, res) => {
    try {
      const page = Number.parseInt(String(req.query?.page)) || 1
      const { docs, pagination } = await fetchAllGrantPayments(page)

      return res.response({ docs, pagination }).code(statusCodes.ok)
    } catch (err) {
      req.log(['error'], err)
      return res
        .response({
          message: 'Internal Server Error',
          error: serializeError(err)
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { getTestGrantPaymentController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
