import { statusCodes } from '#~/common/constants/status-codes.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'

const postTestGrantPaymentController = {
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
      const created = await createGrantPayment(req.payload)

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
            message: 'Validation error',
            error: serializeError(err)
          })
          .code(statusCodes.badRequest)
      }

      return res
        .response({
          message: 'Internal Server Error',
          error: serializeError(err)
        })
        .code(statusCodes.internalServerError)
    }
  }
}

export { postTestGrantPaymentController }
