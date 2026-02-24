import { statusCodes } from '#~/common/constants/status-codes.js'
import { fetchAllGrantPayments } from '#~/common/helpers/fetch-all-grant-payments.js'

const getTestGrantPaymentController = {
  method: 'GET',
  path: '/api/test/grant-payments',
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
      const grantPayments = await fetchAllGrantPayments()

      return res.response(grantPayments).code(statusCodes.ok)
    } catch (err) {
      req.log(['error'], err)
      return res
        .response({
          error: 'Internal Server Error'
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { getTestGrantPaymentController }
