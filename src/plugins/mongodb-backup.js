import mongoose from 'mongoose'
import { config } from '#~/config/index.js'

const pad = (value) => String(value).padStart(2, '0')

const formatTimestamp = (date = new Date()) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}-${pad(
    date.getUTCHours()
  )}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`

const parseTimestamp = (timestamp) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/.exec(
    timestamp
  )
  if (!match) {
    return null
  }

  const [year, month, day, hour, minute, second] = match.slice(1).map(Number)
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second))
}

const backupCollectionName = (collectionName, timestamp) =>
  `backup_${collectionName}_${timestamp}`

const isBackupCollection = (collectionName) =>
  collectionName.startsWith('backup_')
const isSystemCollection = (collectionName) =>
  collectionName.startsWith('system.')

const getBackupCollectionInfo = (collectionName) => {
  const match = /^backup_(.+)_(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})$/.exec(
    collectionName
  )

  if (!match) {
    return null
  }

  return {
    originalName: match[1],
    timestamp: match[2]
  }
}

const copyCollection = async (db, sourceName, targetName) => {
  await db
    .collection(sourceName)
    .aggregate([{ $match: {} }, { $out: targetName }])
    .toArray()
}

const backupAllCollections = async (db) => {
  const timestamp = formatTimestamp()
  const collections = await db.collections()

  const collectionNames = collections
    .map((collection) => collection.collectionName)
    .filter((name) => !isBackupCollection(name) && !isSystemCollection(name))

  for (const collectionName of collectionNames) {
    await copyCollection(
      db,
      collectionName,
      backupCollectionName(collectionName, timestamp)
    )
  }

  return timestamp
}

const cleanupOldBackups = async (db) => {
  const retentionDays = config.get('backup.retentionDays')
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const collections = await db.collections()
  const removed = []

  for (const collection of collections) {
    const collectionName = collection.collectionName
    if (isBackupCollection(collectionName)) {
      const backupInfo = getBackupCollectionInfo(collectionName)
      const backupDate = backupInfo && parseTimestamp(backupInfo.timestamp)
      if (backupDate && backupDate.getTime() < cutoff) {
        await db.dropCollection(collectionName)
        removed.push(collectionName)
      }
    }
  }
  return removed
}

const restoreBackup = async (db, restoreTimestamp, server) => {
  const collections = await db.collections()
  const matchingBackups = collections
    .map((collection) => collection.collectionName)
    .map((collectionName) => ({
      collectionName,
      backupInfo: getBackupCollectionInfo(collectionName)
    }))
    .filter(({ backupInfo }) => backupInfo?.timestamp === restoreTimestamp)

  if (matchingBackups.length === 0) {
    server.logger.warn(
      `mongodb-backup: no matching backup collections found for timestamp ${restoreTimestamp}`
    )
    return
  }

  for (const { collectionName, backupInfo } of matchingBackups) {
    const originalName = backupInfo.originalName

    const originalExists = collections.some(
      (c) => c.collectionName === originalName
    )
    if (originalExists) {
      await db.dropCollection(originalName)
    }

    await copyCollection(db, collectionName, originalName)

    server.logger.info(
      `mongodb-backup: restored ${originalName} from ${collectionName}`
    )
  }
}

const runBackupPlugin = async (server) => {
  const db = mongoose.connection?.db
  if (!db) {
    throw new Error('MongoDB connection is not available')
  }

  const backupTimestamp = await backupAllCollections(db)
  server.logger.info(
    `mongodb-backup: created full backup at ${backupTimestamp}`
  )

  const restoreTimestamp = config.get('backup.restoreTimestamp')
  if (restoreTimestamp) {
    server.logger.info(
      `mongodb-backup: restoring backup for timestamp ${restoreTimestamp}`
    )
    await restoreBackup(db, restoreTimestamp, server)
    return
  }

  const removed = await cleanupOldBackups(db)
  if (removed.length) {
    server.logger.info(
      `mongodb-backup: cleaned up expired backup collections ${JSON.stringify(
        removed
      )}`
    )
  }
}

const mongodbBackup = {
  plugin: {
    name: 'mongodb-backup',
    register: async (server) => {
      server.logger.info('Registering mongodb-backup plugin')

      if (config.get('featureFlags.enableBackups') !== true) {
        server.logger.warn('mongodb-backup: backups are disabled')
        return
      }

      const execute = async () => {
        try {
          await runBackupPlugin(server)
        } catch (error) {
          server.logger.error(error, 'mongodb-backup: backup failed')
        }
      }

      if (mongoose.connection?.readyState === 1 && mongoose.connection?.db) {
        await execute()
      } else {
        mongoose.connection.once('connected', async () => {
          await execute()
        })
      }
    }
  }
}

export { mongodbBackup }
