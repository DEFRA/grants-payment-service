import GrantPaymentsModel from '#~/api/common/models/grant_payments.js'

export const cancelGrantPayments = async (sbi, frn) => {
  const today = new Date().toISOString().split('T')[0]

  const grantPayments = await GrantPaymentsModel.find({ sbi, frn })

  const updatedPayments = []

  for (const grantPayment of grantPayments) {
    let hasChanges = false
    grantPayment.grants.forEach((grant) => {
      grant.payments.forEach((payment) => {
        if (payment.status === 'pending' && payment.dueDate >= today) {
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

  return updatedPayments
}
