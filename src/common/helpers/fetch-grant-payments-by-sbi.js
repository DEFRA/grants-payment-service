import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { config } from '#~/config/index.js'
import { wrapWithPagination } from './pagination.js'

export const fetchGrantPaymentsBySbi = async (sbi, page) => {
  const match = { sbi }
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
