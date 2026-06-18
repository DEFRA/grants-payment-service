import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'
import { getTodaysDate } from '#~/common/helpers/date.js'

export const cancelGrantPayments = async (sbi, frn) => {
  const today = getTodaysDate()

  const grantPayments = await GrantPaymentsModel.find({ sbi, frn })

  const updatedPayments = []

  for (const grantPayment of grantPayments) {
    let hasChanges = false
    grantPayment.grants.forEach((grant) => {
      grant.payments.forEach((payment) => {
        if (
          payment.status === 'pending' &&
          new Date(payment.dueDate) >= new Date(today)
        ) {
          payment.status = 'cancelled'
          hasChanges = true
        }
      })
    })

    if (hasChanges) {
      await grantPayment.save()
      updatedPayments.push(grantPayment)
    }
  }

  return { updatedPayments, foundGrantPayments: grantPayments }
}
