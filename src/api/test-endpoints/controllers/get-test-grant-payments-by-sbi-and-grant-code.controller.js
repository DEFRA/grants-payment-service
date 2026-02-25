import { fetchGrantPaymentsBySbiAndGrantCode } from '#~/common/helpers/fetch-grant-payments-by-sbi-and-grant-code.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

const getTestGrantPaymentsBySbiAndGrantCodeController = {
  method: 'GET',
  path: '/api/test/grant-payments/{sbi}/{grantCode}',
  options: {
    description: 'Fetch all grant-payments for a given SBI and grant code',
    tags: ['api', 'test'],
    auth: false,
    timeout: {
      server: false,
      socket: false
    }
  },
  handler: async (req, res) => {
    try {
      const { sbi, grantCode } = req.params
      const payments = await fetchGrantPaymentsBySbiAndGrantCode(sbi, grantCode)

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

export { getTestGrantPaymentsBySbiAndGrantCodeController }
