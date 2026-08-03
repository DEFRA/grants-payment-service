import { fetchGrantPaymentsBySbi } from '#~/common/helpers/fetch-grant-payments-by-sbi.js'
import { serializeError } from '#~/common/helpers/serialize-error.js'
import { statusCodes } from '#~/common/constants/status-codes.js'

/**
 * Controller to get all grant payments for a given SBI
 * @satisfies {Partial<ServerRoute>}
 */
const getTestPaymentsBySbiController = {
  options: {
    description:
      'Fetch all grant-payments for a given SBI, optionally filtered by fund code',
    tags: ['api', 'test'],
    auth: false,
    timeout: {
      server: false,
      socket: false
    }
  },
  /**
   * @param {import('@hapi/hapi').Request & { params: { sbi: string, fundCode?: string } }} req
   * @param {import('@hapi/hapi').ResponseToolkit} res
   * @returns {Promise<import('@hapi/hapi').ResponseObject>}
   */
  handler: async (req, res) => {
    try {
      const { sbi, fundCode } = req.params
      const page = Number.parseInt(String(req.query?.page)) || 1
      const { docs, pagination } = await fetchGrantPaymentsBySbi(
        sbi,
        fundCode,
        page
      )

      return res
        .response({ sbi, ...(fundCode && { fundCode }), docs, pagination })
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

export { getTestPaymentsBySbiController }

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
