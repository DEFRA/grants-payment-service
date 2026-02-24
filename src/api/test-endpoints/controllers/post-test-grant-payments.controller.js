import { statusCodes } from '#~/common/constants/status-codes.js'
import { createGrantPayment } from '#~/common/helpers/create-grant-payment.js'
import { fetchGrantPaymentsBySbi } from '#~/common/helpers/fetch-grant-payments-by-sbi.js'

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

      if (await overlappingDatesInGrantPayments(sbi, payload)) {
        return res
          .response({
            error: 'Validation error',
            message:
              'For the given sbi overlapping grant payment already exists'
          })
          .code(statusCodes.badRequest)
      }

      const created = await createGrantPayment(payload)

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

const overlappingDatesInGrantPayments = async (sbi, incomingPayload) => {
  const existingGrantsMatchingSbi = await fetchGrantPaymentsBySbi(sbi)

  if (!existingGrantsMatchingSbi || existingGrantsMatchingSbi.length === 0) {
    return false
  }

  const incomingDueDates = new Set()
  incomingPayload.grants?.forEach((grant) => {
    if (grant.dueDate) {
      incomingDueDates.add(grant.dueDate)
    }
    grant.payments?.forEach((payment) => {
      if (payment.dueDate) {
        incomingDueDates.add(payment.dueDate)
      }
    })
  })

  for (const existingRecord of existingGrantsMatchingSbi) {
    for (const grant of existingRecord.grants || []) {
      if (grant.dueDate && incomingDueDates.has(grant.dueDate)) {
        return true
      }
      for (const payment of grant.payments || []) {
        if (payment.dueDate && incomingDueDates.has(payment.dueDate)) {
          return true
        }
      }
    }
  }

  return false
}

export { postTestGrantPaymentController }
