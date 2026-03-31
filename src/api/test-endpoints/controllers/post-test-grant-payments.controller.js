import { statusCodes } from '#~/common/constants/status-codes.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { prepareWithPaymentHubConfig } from '#~/common/helpers/payment-hub/prepare-with-payment-hub-config.js'

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

      const grantPaymentWithPaymentHubConfig =
        prepareWithPaymentHubConfig(payload)

      const created = await createGrantPayment(grantPaymentWithPaymentHubConfig)

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
