import { deleteGrantPaymentsBySbiAndFundCode } from '#~/common/helpers/delete-grant-payments-by-sbi-and-fund-code.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

const deleteTestGrantPaymentsBySbiAndFundCodeController = {
  options: {
    description: 'Delete all grant-payments for a given SBI and fund code',
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
      const { deletedCount } = await deleteGrantPaymentsBySbiAndFundCode(
        sbi,
        fundCode
      )

      return res.response({ sbi, fundCode, deletedCount }).code(statusCodes.ok)
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

export { deleteTestGrantPaymentsBySbiAndFundCodeController }
