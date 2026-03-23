import { fetchGrantPaymentsBySbiAndGrantCode } from '#~/common/helpers/fetch-grant-payments-by-sbi-and-grant-code.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

const getTestGrantPaymentsBySbiAndGrantCodeController = {
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
          message: 'Internal Server Error',
          error: serializeError(err)
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { getTestGrantPaymentsBySbiAndGrantCodeController }
