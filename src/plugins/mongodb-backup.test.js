import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockConfigGet = vi.fn()

vi.mock('#~/config/index.js', () => ({
  config: {
    get: mockConfigGet
  }
}))

let collectionsMap
let db
const onceMock = vi.fn()

const mongooseMock = {
  default: {
    connection: {
      readyState: 1,
      get db() {
        return db
      },
      once: onceMock
    },
    Types: {
      Decimal128: class Decimal128 {
        constructor(value) {
          this.value = value
        }
      }
    },
    Schema: class Schema {
      constructor(definition, options) {
        this.definition = definition
        this.options = options
        this.indexes = []
      }
      index(fields, options) {
        this.indexes.push({ fields, options })
        return this
      }
    },
    model: vi.fn()
  }
}

vi.mock('mongoose', () => mongooseMock)

const createCollectionStub = (name) => ({
  collectionName: name,
  find: () => ({
    toArray: async () => {
      return collectionsMap.get(name)?.docs ?? []
    }
  }),
  aggregate: (pipeline) => {
    const outStage = pipeline[pipeline.length - 1]
    const targetName = outStage?.$out

    return {
      toArray: async () => {
        if (typeof targetName === 'string') {
          const docs = collectionsMap.get(name)?.docs ?? []
          collectionsMap.set(targetName, { docs: [...docs] })
        }
        return []
      }
    }
  },
  insertMany: async (docs) => {
    collectionsMap.set(name, { docs: [...docs] })
  },
  deleteMany: async () => {
    collectionsMap.set(name, { docs: [] })
    return { deletedCount: 0 }
  }
})

const buildDb = () => ({
  collections: async () =>
    Array.from(collectionsMap.keys()).map((collectionName) => ({
      collectionName
    })),
  collection: (collectionName) => createCollectionStub(collectionName),
  dropCollection: vi.fn(async (collectionName) => {
    collectionsMap.delete(collectionName)
  })
})

const reloadPlugin = async () => {
  vi.resetModules()
  const { mongodbBackup } = await import('./mongodb-backup.js')
  return mongodbBackup
}

describe('mongodb-backup plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    collectionsMap = new Map()
    db = buildDb()
    onceMock.mockReset()
  })

  it('creates full backup collections at startup and skips backup/system collections', async () => {
    collectionsMap.set('grant_payments', { docs: [{ _id: '1', value: 1 }] })
    collectionsMap.set('system.indexes', { docs: [] })
    collectionsMap.set('backup_grant_payments_2025-01-01-00-00-00', {
      docs: [{ _id: '2', value: 2 }]
    })

    mockConfigGet.mockImplementation((path) => {
      if (path === 'featureFlags.enableBackups') return true
      if (path === 'backup.retentionDays') return 365
      if (path === 'backup.restoreTimestamp') return null
      return null
    })

    const mongodbBackup = await reloadPlugin()
    const mongoose = await import('mongoose')
    expect(mongoose.default.connection.db).toBe(db)

    const fakeServer = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }
    await mongodbBackup.plugin.register(fakeServer)

    const backupEntry = Array.from(collectionsMap.entries()).find(
      ([name, stored]) =>
        /^backup_grant_payments_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(
          name
        ) && stored.docs[0]?.value === 1
    )

    expect(backupEntry).toBeDefined()
    expect(backupEntry?.[1].docs).toEqual([{ _id: '1', value: 1 }])
  })

  it('drops backup collections older than retentionDays', async () => {
    collectionsMap.set('backup_grant_payments_2020-01-01-00-00-00', {
      docs: [{ _id: 'old' }]
    })
    collectionsMap.set('backup_grant_payments_2026-05-10-00-00-00', {
      docs: [{ _id: 'new' }]
    })

    mockConfigGet.mockImplementation((path) => {
      if (path === 'featureFlags.enableBackups') return true
      if (path === 'backup.retentionDays') return 30
      if (path === 'backup.restoreTimestamp') return null
      return null
    })

    const mongodbBackup = await reloadPlugin()
    const fakeServer = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }

    await mongodbBackup.plugin.register(fakeServer)

    expect(db.dropCollection).toHaveBeenCalledWith(
      'backup_grant_payments_2020-01-01-00-00-00'
    )
    expect(
      collectionsMap.has('backup_grant_payments_2026-05-10-00-00-00')
    ).toBe(true)
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'mongodb-backup: cleaned up expired backup collections ["backup_grant_payments_2020-01-01-00-00-00"]'
    )
  })

  it('restores a backup directly to the original collection', async () => {
    collectionsMap.set('grant_payments', { docs: [{ _id: '1', value: 1 }] })
    collectionsMap.set('backup_grant_payments_2025-01-01-00-00-00', {
      docs: [{ _id: '2', value: 2 }]
    })

    mockConfigGet.mockImplementation((path) => {
      if (path === 'featureFlags.enableBackups') return true
      if (path === 'backup.retentionDays') return 1000
      if (path === 'backup.restoreTimestamp') return '2025-01-01-00-00-00'
      return null
    })

    const mongodbBackup = await reloadPlugin()
    const fakeServer = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }

    await mongodbBackup.plugin.register(fakeServer)

    expect(db.dropCollection).toHaveBeenCalledWith('grant_payments')
    expect(collectionsMap.get('grant_payments').docs).toEqual([
      { _id: '2', value: 2 }
    ])
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'mongodb-backup: restored grant_payments from backup_grant_payments_2025-01-01-00-00-00'
    )
  })

  it('does not attempt to drop the collection during restore if the collection does not exist', async () => {
    collectionsMap.set('backup_grant_payments_2025-01-01-00-00-00', {
      docs: [{ _id: '2', value: 2 }]
    })

    mockConfigGet.mockImplementation((path) => {
      if (path === 'featureFlags.enableBackups') return true
      if (path === 'backup.retentionDays') return 1000
      if (path === 'backup.restoreTimestamp') return '2025-01-01-00-00-00'
      return null
    })

    const mongodbBackup = await reloadPlugin()
    const fakeServer = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }

    await mongodbBackup.plugin.register(fakeServer)

    expect(db.dropCollection).not.toHaveBeenCalledWith('grant_payments')
    expect(collectionsMap.get('grant_payments').docs).toEqual([
      { _id: '2', value: 2 }
    ])
  })

  it('skips cleanup of old backups when restoreTimestamp is set', async () => {
    collectionsMap.set('grant_payments', { docs: [{ _id: '1', value: 1 }] })
    collectionsMap.set('backup_grant_payments_2025-01-01-00-00-00', {
      docs: [{ _id: '2', value: 2 }]
    })
    collectionsMap.set('backup_grant_payments_2020-01-01-00-00-00', {
      docs: [{ _id: 'old' }]
    })

    mockConfigGet.mockImplementation((path) => {
      if (path === 'featureFlags.enableBackups') return true
      if (path === 'backup.retentionDays') return 30
      if (path === 'backup.restoreTimestamp') return '2025-01-01-00-00-00'
      return null
    })

    const mongodbBackup = await reloadPlugin()
    const fakeServer = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }

    await mongodbBackup.plugin.register(fakeServer)

    expect(
      collectionsMap.has('backup_grant_payments_2020-01-01-00-00-00')
    ).toBe(true)
    expect(fakeServer.logger.info).not.toHaveBeenCalledWith(
      'mongodb-backup: cleaned up expired backup collections ["backup_grant_payments_2020-01-01-00-00-00"]'
    )
  })

  it('logs a warning and returns early if feature flag enableBackups is false', async () => {
    mockConfigGet.mockImplementation((path) => {
      if (path === 'featureFlags.enableBackups') return false
      return null
    })

    const mongodbBackup = await reloadPlugin()
    const fakeServer = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }

    await mongodbBackup.plugin.register(fakeServer)

    expect(fakeServer.logger.warn).toHaveBeenCalledWith(
      'mongodb-backup: backups are disabled'
    )
    expect(db.dropCollection).not.toHaveBeenCalled()
  })
})
