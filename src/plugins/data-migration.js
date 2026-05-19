import mongoose from 'mongoose'
import GrantPayments from '#~/api/common/models/grant_payments.js'
import { config } from '#~/config/index.js'

const dataMigration = {
  plugin: {
    name: 'data-migration',
    register: async (server) => {
      server.logger.info('Registering data-migration plugin')

      const dueDate = config.get('dataMigration.dueDate')

      async function runMigration() {
        try {
          const res = await GrantPayments.updateMany(
            {
              'grants.payments.dueDate': dueDate,
              'grants.payments.status': 'failed'
            },
            { $set: { 'grants.$[].payments.$[p].status': 'submitted' } },
            { arrayFilters: [{ 'p.dueDate': dueDate, 'p.status': 'failed' }] }
          )

          server.logger.info(res, 'data-migration: update result')
        } catch (err) {
          server.logger.error(err, 'data-migration: migration failed')
        }
      }

      // If mongoose already connected, run immediately; otherwise wait for connection
      if (mongoose.connection?.readyState === 1) {
        await runMigration()
      } else {
        mongoose.connection.once('connected', async () => {
          await runMigration()
        })
      }
    }
  }
}

export { dataMigration }
