import GrantPaymentsModel from '../../common/grant_payments.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

const postTestGrantPaymentController = {
  method: 'POST',
  path: '/api/test/grant-payments',
  options: {
    description: 'Populate grant payment with sample data for testing',
    tags: ['api', 'test'],
    auth: false,
    timeout: {
      server: false,
      socket: false
    }
  },
  handler: async (req, res) => {
    try {
      const payload = req.payload
      const { sbi } = payload

      if (await validationCheckForOverlappingGrantPayment(sbi)) {
        return res
          .response({
            error: 'Validation error',
            message:
              'For the given sbi overlapping grant payment already exists'
          })
          .code(statusCodes.badRequest)
      }

      const created = await GrantPaymentsModel.create(payload)

      const id = created?._id?.toString?.() || created?.id || created?._id

      return res
        .response({
          id,
          message: 'Grant payments created'
        })
        .code(statusCodes.created)
    } catch (err) {
      if (err?.name === 'ValidationError' || err?.name === 'ValidatorError') {
        return res
          .response({
            error: 'Validation error',
            message: err.message
          })
          .code(statusCodes.badRequest)
      }

      return res
        .response({
          error: 'Internal Server Error'
        })
        .code(statusCodes.internalServerError)
    }
  }
}

const validationCheckForOverlappingGrantPayment = async (sbi) => {
  // const existingGrantsMatchingSbi = fetchGrantPaymentsBySbi(sbi)
  return false
}

export { postTestGrantPaymentController }
