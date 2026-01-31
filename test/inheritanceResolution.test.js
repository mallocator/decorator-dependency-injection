import {
  Singleton,
  Inject,
  clearContainer
} from '../index.js'

describe('Inheritance Resolution', () => {
  afterEach(() => {
    clearContainer()
  })

  it('should NOT resolve subclass when injecting by parent class', () => {
    // Parent class - NOT decorated
    class Database {
      name = 'base'
    }

    // Subclass IS registered
    @Singleton()
    class PostgresDB extends Database {
      name = 'postgres'
    }

    class Service {
      @Inject(Database) db  // Trying to inject by parent class
    }

    // This should fail - Database is not registered, only PostgresDB is
    expect(() => new Service()).toThrow(/Cannot find injection source/)
  })

  it('should resolve when injecting by the exact registered class', () => {
    class Database {
      name = 'base'
    }

    @Singleton()
    class PostgresDB extends Database {
      name = 'postgres'
    }

    class Service {
      @Inject(PostgresDB) db  // Inject by exact registered class
    }

    const s = new Service()
    expect(s.db.name).toBe('postgres')
    expect(s.db instanceof Database).toBe(true)
    expect(s.db instanceof PostgresDB).toBe(true)
  })
})
