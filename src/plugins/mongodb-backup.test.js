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
    }
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
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))

    collectionsMap.set('backup_grant_payments_2020-01-01-00-00-00', {
      docs: [{ _id: 'delete-me' }]
    })
    collectionsMap.set('backup_grant_payments_2024-12-15-00-00-00', {
      docs: [{ _id: 'keep-me' }]
    })

    mockConfigGet.mockImplementation((path) => {
      if (path === 'backup.retentionDays') return 30
      if (path === 'backup.restoreTimestamp') return null
      return null
    })

    const mongodbBackup = await reloadPlugin()
    const fakeServer = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }

    await mongodbBackup.plugin.register(fakeServer)

    vi.useRealTimers()

    expect(db.dropCollection).toHaveBeenCalledWith(
      'backup_grant_payments_2020-01-01-00-00-00'
    )
    expect(
      collectionsMap.has('backup_grant_payments_2024-12-15-00-00-00')
    ).toBe(true)
  })

  it('restores a backup directly to the original collection without a failsafe copy', async () => {
    collectionsMap.set('grant_payments', { docs: [{ _id: '1', value: 1 }] })
    collectionsMap.set('backup_grant_payments_2025-01-01-00-00-00', {
      docs: [{ _id: '2', value: 2 }]
    })

    mockConfigGet.mockImplementation((path) => {
      if (path === 'backup.retentionDays') return 1000
      if (path === 'backup.restoreTimestamp') return '2025-01-01-00-00-00'
      return null
    })

    const mongodbBackup = await reloadPlugin()
    const fakeServer = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }

    await mongodbBackup.plugin.register(fakeServer)

    expect(
      Array.from(collectionsMap.keys()).some((name) =>
        /^backup_failsafe_grant_payments_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(
          name
        )
      )
    ).toBe(false)
    expect(collectionsMap.get('grant_payments').docs).toEqual([
      { _id: '2', value: 2 }
    ])
    expect(fakeServer.logger.info).toHaveBeenCalledWith(
      'mongodb-backup: restored grant_payments from backup_grant_payments_2025-01-01-00-00-00'
    )
  })
})
