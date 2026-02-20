import GrantPaymentsModel from '../../common/grant_payments.js'

const postTestCreateGrantPaymentController = {
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
      const created = await GrantPaymentsModel.create(payload)

      return res
        .response({
          id: created._id?.toString?.() ?? created.id ?? created._id,
          message: 'Grant payments created'
        })
        .code(201)
    } catch (err) {
      if (
        err &&
        (err.name === 'ValidationError' || err.name === 'ValidatorError')
      ) {
        return res
          .response({
            error: 'Validation error',
            message: err.message
          })
          .code(400)
      }

      return res
        .response({
          error: 'Internal Server Error'
        })
        .code(500)
    }
  }
}

export { postTestCreateGrantPaymentController }
