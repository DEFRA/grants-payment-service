import { vi } from 'vitest'

const mockPing = vi.fn()
const mockModel = vi.fn().mockImplementation((_collection, schema) => {
  // Create a base mock with standard mongoose methods
  const mock = {
    find: vi.fn().mockReturnThis(),
    findOne: vi.fn().mockReturnThis(),
    findById: vi.fn().mockReturnThis(),
    create: vi.fn().mockReturnThis(),
    updateOne: vi.fn().mockReturnThis(),
    updateMany: vi.fn().mockReturnThis(),
    deleteOne: vi.fn().mockReturnThis(),
    deleteMany: vi.fn().mockReturnThis(),
    countDocuments: vi.fn().mockReturnThis(),
    aggregate: vi.fn().mockReturnThis(),
    distinct: vi.fn().mockReturnThis(),
    findOneAndUpdate: vi.fn().mockReturnThis(),
    lean: vi.fn().mockReturnThis()
  }

  // Preserve static methods from the schema if they exist
  if (schema?.statics) {
    Object.assign(mock, schema.statics)
  }

  return mock
})

// Minimal Schema constructor so code using `new mongoose.Schema(...)` works
class MockSchema {
  constructor(definition, options) {
    this.definition = definition
    this.options = options || {}
    this._indexes = []
    this._plugins = []

    // Ensure statics/methods exist so code can assign to them
    this.statics = {}
    this.methods = {}
    // simple hook storage to avoid errors if code registers hooks
    this._hooks = { pre: [], post: [] }
  }

  // support schema.index(...)
  index(fields, opts) {
    this._indexes.push({ fields, opts })
    return this
  }

  // minimal set to allow schema.set(...)
  set(key, value) {
    this.options[key] = value
    return this
  }

  // minimal plugin support
  plugin(fn, opts) {
    this._plugins.push({ fn, opts })
    return this
  }

  // minimal virtual API (chainable)
  virtual() {
    return {
      get: vi.fn(),
      set: vi.fn(),
      applyGetters: vi.fn()
    }
  }

  // support registering middleware hooks
  pre(hookName, fn) {
    this._hooks.pre.push({ hookName, fn })
    return this
  }

  post(hookName, fn) {
    this._hooks.post.push({ hookName, fn })
    return this
  }
}

// Provide Schema.Types so code that accesses mongoose.Schema.Types.ObjectId works
MockSchema.Types = {
  ObjectId: vi.fn(),
  Mixed: class MockMixed {}
}

// Provide a basic Decimal128 mock for schema type usage
class MockDecimal128 {
  constructor(value) {
    this._v = value
  }

  static fromString(v) {
    return new MockDecimal128(v)
  }
}

const mockConnection = {
  db: {
    admin: () => ({ ping: mockPing })
  },
  readyState: 1, // Connected state
  on: vi.fn(),
  once: vi.fn(),
  close: vi.fn()
}

const mongooseDefault = {
  connect: vi.fn().mockResolvedValue(mockConnection),
  disconnect: vi.fn(),
  connection: mockConnection,
  Schema: MockSchema,
  model: mockModel,
  Types: { ObjectId: vi.fn() },
  // common mongoose numeric type used across schemas
  Decimal128: MockDecimal128,
  set: vi.fn()
}

// default export is the mock mongoose API
export default mongooseDefault

// named exports so tests can control behavior via dynamic import('mongoose')
// also expose Decimal128 as a named export so `import { Decimal128 } from 'mongoose'` works
export {
  mockPing as __mockPing,
  mockModel as __mockModel,
  MockDecimal128 as Decimal128
}
