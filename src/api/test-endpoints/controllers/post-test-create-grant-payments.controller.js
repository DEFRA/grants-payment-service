import GrantPaymentsModel from '../../common/grant_payments.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

const postTestCreateGrantPaymentController = {
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

export { postTestCreateGrantPaymentController }
