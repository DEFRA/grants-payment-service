import { fetchGrantPaymentsBySbi } from '#~/common/helpers/fetch-grant-payments-by-sbi.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

const getTestPaymentsBySbiController = {
  options: {
    description: 'Fetch all grant-payments for a given SBI',
    tags: ['api', 'test'],
    auth: false,
    timeout: {
      server: false,
      socket: false
    }
  },
  handler: async (req, res) => {
    try {
      const { sbi } = req.params
      const payments = await fetchGrantPaymentsBySbi(sbi)

      return res.response(payments).code(statusCodes.ok)
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

export { getTestPaymentsBySbiController }
