import { vi } from 'vitest'
import { getStats } from '#~/common/helpers/get-stats.js'

const MOCK_ACCOUNT_COUNT = 10
const MOCK_GRANT_COUNT = 15
const MOCK_PENDING_COUNT = 5
const MOCK_SUBMITTED_COUNT = 3
const MOCK_CANCELLED_COUNT = 2
const MOCK_EMPTY_ACCOUNT_COUNT = 5
const MOCK_EMPTY_GRANT_COUNT = 3
const MOCK_SINGLE_PAYMENT_COUNT = 2
const MOCK_EMPTY_GRANT_STATS_COUNT = 7

vi.mock('#~/api/common/models/grant_payments.js', () => ({
  default: {
    countDocuments: vi.fn(),
    aggregate: vi.fn()
  }
}))

describe('getStats', () => {
  let mockGrantPayments

  beforeAll(async () => {
    mockGrantPayments = (await import('#~/api/common/models/grant_payments.js'))
      .default
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const setupMocks = (
    accounts,
    grantStats,
    paymentStats,
    pendingOverdue = [{ count: 0 }]
  ) => {
    mockGrantPayments.countDocuments.mockResolvedValue(accounts)
    mockGrantPayments.aggregate
      .mockResolvedValueOnce(grantStats)
      .mockResolvedValueOnce(paymentStats)
      .mockResolvedValueOnce(pendingOverdue)
  }

  test('Should provide expected stats', async () => {
    setupMocks(
      MOCK_ACCOUNT_COUNT,
      [{ _id: null, count: MOCK_GRANT_COUNT }],
      [
        { _id: 'pending', count: MOCK_PENDING_COUNT },
        { _id: 'submitted', count: MOCK_SUBMITTED_COUNT },
        { _id: 'cancelled', count: MOCK_CANCELLED_COUNT }
      ],
      [{ count: 0 }],
      [{ count: 1 }]
    )

    const result = await getStats()

    expect(result).toEqual({
      accounts: MOCK_ACCOUNT_COUNT,
      grants: MOCK_GRANT_COUNT,
      payments: {
        total: MOCK_PENDING_COUNT + MOCK_SUBMITTED_COUNT + MOCK_CANCELLED_COUNT,
        pending: {
          total: MOCK_PENDING_COUNT,
          overdue: 0
        },
        submitted: MOCK_SUBMITTED_COUNT,
        cancelled: MOCK_CANCELLED_COUNT,
        locked: 0,
        failed: 0
      }
    })
  })

  test('Should handle empty grant stats', async () => {
    setupMocks(
      MOCK_EMPTY_ACCOUNT_COUNT,
      [],
      [{ _id: 'pending', count: MOCK_SINGLE_PAYMENT_COUNT }],
      [{ count: 0 }],
      [{ count: 1 }]
    )

    const result = await getStats()

    expect(result).toEqual({
      accounts: MOCK_EMPTY_ACCOUNT_COUNT,
      grants: 0,
      payments: {
        total: MOCK_SINGLE_PAYMENT_COUNT,
        pending: {
          total: MOCK_SINGLE_PAYMENT_COUNT,
          overdue: 0
        },
        submitted: 0,
        cancelled: 0,
        locked: 0,
        failed: 0
      }
    })
  })

  test('Should handle empty payment stats', async () => {
    setupMocks(
      MOCK_EMPTY_GRANT_COUNT,
      [{ _id: null, count: MOCK_EMPTY_GRANT_STATS_COUNT }],
      [],
      [{ count: 0 }],
      [{ count: 0 }]
    )

    const result = await getStats()

    expect(result).toEqual({
      accounts: 3,
      grants: 7,
      payments: {
        total: 0,
        pending: { total: 0, overdue: 0 },
        submitted: 0,
        cancelled: 0,
        locked: 0,
        failed: 0
      }
    })
  })

  test('Should handle database error', async () => {
    mockGrantPayments.countDocuments.mockRejectedValue(new Error('DB error'))

    await expect(getStats()).rejects.toThrow('DB error')
  })
})
