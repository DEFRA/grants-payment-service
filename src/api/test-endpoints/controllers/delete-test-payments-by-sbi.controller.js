import { deleteGrantPaymentsBySbi } from '#~/common/helpers/delete-grant-payments-by-sbi.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

const deleteTestPaymentsBySbiController = {
  options: {
    description: 'Delete all grant-payments for a given SBI',
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
      const { deletedCount } = await deleteGrantPaymentsBySbi(sbi)

      return res.response({ sbi, deletedCount }).code(statusCodes.ok)
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

export { deleteTestPaymentsBySbiController }
