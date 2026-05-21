import mongoose from 'mongoose'
import GrantPayments from '#~/api/common/models/grant_payments.js'

const sortStrings = (values) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b))

const extractGrantCorrelationIds = (doc) => {
  const grantCorrelationIds = []

  for (const grant of doc.grants || []) {
    if (grant?.correlationId) {
      grantCorrelationIds.push(grant.correlationId)
    }
  }

  return grantCorrelationIds
}

const buildSignature = (doc) => {
  const grantCorrelationIds = extractGrantCorrelationIds(doc)
  if (grantCorrelationIds.length === 0) {
    return null
  }

  return [
    `root:${doc.sbi ?? ''}`,
    `frn:${doc.frn ?? ''}`,
    `claimId:${doc.claimId ?? ''}`,
    `grants:${sortStrings(grantCorrelationIds).join(',')}`
  ].join('|')
}

const getDuplicateIds = (docs) => {
  const seen = new Map()
  const duplicateIds = []

  for (const doc of docs) {
    const signature = buildSignature(doc)
    if (!signature) {
      continue
    }

    const existing = seen.get(signature)
    if (existing) {
      const keepCurrent =
        existing.createdAt && doc.createdAt
          ? doc.createdAt < existing.createdAt
          : false

      if (keepCurrent) {
        duplicateIds.push(existing.keepId)
        seen.set(signature, {
          keepId: doc._id,
          createdAt: doc.createdAt
        })
      } else {
        duplicateIds.push(doc._id)
      }
    } else {
      seen.set(signature, {
        keepId: doc._id,
        createdAt: doc.createdAt
      })
    }
  }

  return duplicateIds
}

const runDeduplication = async (server) => {
  const docs = await GrantPayments.find(
    {},
    {
      _id: 1,
      sbi: 1,
      frn: 1,
      claimId: 1,
      createdAt: 1,
      grants: 1
    }
  )
    .lean()
    .exec()

  const duplicateIds = getDuplicateIds(docs)

  if (duplicateIds.length > 0) {
    const result = await GrantPayments.deleteMany({
      _id: { $in: duplicateIds }
    })

    server.logger.info(
      { removedCount: result.deletedCount ?? duplicateIds.length },
      'remove-duplicate-grant-payments: deleted duplicate documents'
    )
  } else {
    server.logger.info(
      'remove-duplicate-grant-payments: no duplicate documents found'
    )
  }

  await GrantPayments.syncIndexes()
  server.logger.info('remove-duplicate-grant-payments: syncIndexes completed')
}

const removeDuplicateGrantPayments = {
  plugin: {
    name: 'remove-duplicate-grant-payments',
    register: async (server) => {
      server.logger.info('Registering remove-duplicate-grant-payments plugin')

      const execute = async () => {
        try {
          await runDeduplication(server)
        } catch (err) {
          server.logger.error(
            err,
            'remove-duplicate-grant-payments: dedupe failed'
          )
        }
      }

      if (mongoose.connection?.readyState === 1) {
        await execute()
      } else {
        mongoose.connection.once('connected', async () => {
          await execute()
        })
      }
    }
  }
}

export { removeDuplicateGrantPayments }
