import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { config } from '#~/config/index.js'
import { wrapWithPagination } from './pagination.js'

export const fetchGrantPaymentsBySbiAndFundCode = async (
  sbi,
  fundCode,
  page
) => {
  const match = {
    sbi,
    'grants.payments.invoiceLines.fundCode': fundCode
  }
  const limit = config.get('paginationLimit')
  const query = GrantPaymentsModel.find(match).sort({ createdAt: -1 })

  if (page) {
    const skip = (page - 1) * limit
    query.skip(skip).limit(limit)
  }

  const [docs, totalDocs] = await Promise.all([
    query.lean(),
    GrantPaymentsModel.countDocuments(match)
  ])

  return wrapWithPagination(docs, totalDocs, page, limit)
}
