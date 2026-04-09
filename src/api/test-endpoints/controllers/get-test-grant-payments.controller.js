import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'
import { fetchAllGrantPayments } from '#~/common/helpers/fetch-all-grant-payments.js'

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
      const page = Number.parseInt(req.query?.page) || 1
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
