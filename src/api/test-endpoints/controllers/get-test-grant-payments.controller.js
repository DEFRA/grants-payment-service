import GrantPaymentsModel from '../../common/grant_payments.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

const getTestGrantPaymentController = {
  options: {
    description: 'Fetch all grant-payments in the database',
    tags: ['api', 'test'],
    auth: false,
    timeout: {
      server: false,
      socket: false
    }
  },
  handler: async (req, res) => {
    try {
      const grantPayments = await GrantPaymentsModel.find({})

      return res.response(grantPayments).code(statusCodes.ok)
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

export { getTestGrantPaymentController }
