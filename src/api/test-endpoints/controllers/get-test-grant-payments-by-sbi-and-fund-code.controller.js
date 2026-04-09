import { fetchGrantPaymentsBySbiAndFundCode } from '#~/common/helpers/fetch-grant-payments-by-sbi-and-fund-code.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

const getTestGrantPaymentsBySbiAndFundCodeController = {
  options: {
    description: 'Fetch all grant-payments for a given SBI and fund code',
    tags: ['api', 'test'],
    auth: false,
    timeout: {
      server: false,
      socket: false
    }
  },
  handler: async (req, res) => {
    try {
      const { sbi, fundCode } = req.params
      const page = Number.parseInt(req.query?.page) || 1
      const { docs, pagination } = await fetchGrantPaymentsBySbiAndFundCode(
        sbi,
        fundCode,
        page
      )

      return res
        .response({ sbi, fundCode, docs, pagination })
        .code(statusCodes.ok)
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

export { getTestGrantPaymentsBySbiAndFundCodeController }
