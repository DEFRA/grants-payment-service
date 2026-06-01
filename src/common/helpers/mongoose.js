import mongoose from 'mongoose'

import { config } from '#~/config/index.js'

/**
 * @satisfies { import('@hapi/hapi').ServerRegisterPluginObject<*> }
 */
export const mongooseDb = {
  plugin: {
    name: 'mongoose',
    version: '1.0.0',
    /**
     *
     * @param { import('@hapi/hapi').Server } server
     * @param {{mongoUrl?: string, databaseName?: string}} [options]
     * @returns {void}
     */
    register: async function (server, options = {}) {
      server.logger.info('Setting up Mongoose')

      const mongoUrl = options.mongoUrl ?? config.get('mongo.uri')
      const databaseName = options.databaseName ?? config.get('mongo.database')

      await mongoose.connect(mongoUrl, {
        dbName: databaseName
      })

      server.logger.info('Mongoose connected to MongoDB')

      server.decorate('server', 'mongooseDb', mongoose.connection)

      server.events.on('stop', async () => {
        server.logger.info('Closing Mongoose client')
        await mongoose.disconnect()
      })
    }
  }
}

/**
 * To be mixed in with Request|Server to provide the db decorator
 * @typedef {{connection: import('mongoose').connection }} MongoosePlugin
 */
