import {
  getContainer,
  hasContainer,
  destroyContainer,
  listContainers,
  resolve,
  isRegistered,
  isMocked,
  removeMock,
  removeAllMocks,
  resetSingletons,
  clearContainer,
  listRegistrations,
  validateRegistrations,
  setDebug,
  unregister,
  getMockInstance,
  Singleton,
  Factory,
  Mock
} from '../index.js'

// Test classes (registered manually to avoid pollution)
class UserService {
  name = 'UserService'
  getUser(id) {
    return { id, name: `User ${id}` }
  }
}

class AuthService {
  name = 'AuthService'
  isAuthenticated() {
    return true
  }
}

class ConfigService {
  name = 'ConfigService'
  get(key) {
    return `config:${key}`
  }
}

describe('Named Scopes', () => {
  afterEach(() => {
    // Clean up all named containers after each test
    for (const name of listContainers()) {
      destroyContainer(name)
    }
    // Also clear the default container
    clearContainer()
  })

  describe('Container Registry', () => {
    it('getContainer() returns default container when no name provided', () => {
      const container = getContainer()
      expect(container).toBeDefined()
      expect(container[Symbol.toStringTag]).toBe('Container')
    })

    it('getContainer(name) creates a new named container', () => {
      const container = getContainer('tenant-a')
      expect(container).toBeDefined()
      expect(hasContainer('tenant-a')).toBe(true)
    })

    it('getContainer(name) returns the same container on subsequent calls', () => {
      const container1 = getContainer('my-scope')
      const container2 = getContainer('my-scope')
      expect(container1).toBe(container2)
    })

    it('different names create different containers', () => {
      const containerA = getContainer('scope-a')
      const containerB = getContainer('scope-b')
      expect(containerA).not.toBe(containerB)
    })

    it('hasContainer() returns false for non-existent containers', () => {
      expect(hasContainer('does-not-exist')).toBe(false)
    })

    it('destroyContainer() removes a named container', () => {
      getContainer('temp-scope')
      expect(hasContainer('temp-scope')).toBe(true)
      
      const result = destroyContainer('temp-scope')
      
      expect(result).toBe(true)
      expect(hasContainer('temp-scope')).toBe(false)
    })

    it('destroyContainer() returns false for non-existent container', () => {
      expect(destroyContainer('not-there')).toBe(false)
    })

    it('destroyContainer() clears the container before removing', () => {
      const container = getContainer('to-destroy')
      container.registerSingleton(UserService)
      expect(container.size).toBe(1)
      
      destroyContainer('to-destroy')
      
      // Getting it again should give us a fresh empty container
      const newContainer = getContainer('to-destroy')
      expect(newContainer.size).toBe(0)
    })

    it('listContainers() returns all named container names', () => {
      getContainer('alpha')
      getContainer('beta')
      getContainer('gamma')
      
      const names = listContainers()
      
      expect(names).toContain('alpha')
      expect(names).toContain('beta')
      expect(names).toContain('gamma')
      expect(names).toHaveLength(3)
    })

    it('listContainers() returns empty array when no named containers', () => {
      expect(listContainers()).toEqual([])
    })
  })

  describe('resolve() with scope', () => {
    beforeEach(() => {
      // Register in default container
      getContainer().registerSingleton(UserService)
      getContainer().registerFactory(AuthService)
    })

    it('resolves from named scope when registered there', () => {
      const scopeContainer = getContainer('tenant-1')
      scopeContainer.registerSingleton(ConfigService)
      
      const config = resolve(ConfigService, { scope: 'tenant-1' })
      
      expect(config).toBeInstanceOf(ConfigService)
    })

    it('auto-registers singleton from default container when not in scope', () => {
      // UserService is in default container but not in tenant-1
      const user1 = resolve(UserService, { scope: 'tenant-1' })
      const user2 = resolve(UserService, { scope: 'tenant-1' })
      
      // Should get same instance (singleton behavior)
      expect(user1).toBe(user2)
      // But different from default container
      expect(user1).not.toBe(resolve(UserService))
    })

    it('auto-registers factory from default container when not in scope', () => {
      const auth1 = resolve(AuthService, { scope: 'tenant-1' })
      const auth2 = resolve(AuthService, { scope: 'tenant-1' })
      
      // Factory creates new instances
      expect(auth1).not.toBe(auth2)
    })

    it('each scope has isolated singleton instances', () => {
      const userA = resolve(UserService, { scope: 'tenant-a' })
      const userB = resolve(UserService, { scope: 'tenant-b' })
      const userDefault = resolve(UserService)
      
      expect(userA).not.toBe(userB)
      expect(userA).not.toBe(userDefault)
      expect(userB).not.toBe(userDefault)
    })

    it('resolves with constructor params in scope', () => {
      class Logger {
        constructor(prefix) {
          this.prefix = prefix
        }
      }
      
      getContainer('app').registerFactory(Logger)
      
      const logger = resolve(Logger, 'my-prefix', { scope: 'app' })
      
      expect(logger.prefix).toBe('my-prefix')
    })

    it('works without scope (backward compatible)', () => {
      const user = resolve(UserService)
      expect(user).toBeInstanceOf(UserService)
    })
  })

  describe('isRegistered() with scope', () => {
    it('checks registration in named scope', () => {
      getContainer('my-scope').registerSingleton(UserService)
      
      expect(isRegistered(UserService, { scope: 'my-scope' })).toBe(true)
      expect(isRegistered(AuthService, { scope: 'my-scope' })).toBe(false)
    })

    it('defaults to default container', () => {
      getContainer().registerSingleton(UserService)
      
      expect(isRegistered(UserService)).toBe(true)
    })
  })

  describe('Mocking with scope', () => {
    class MockUserService {
      name = 'MockUserService'
      getUser(id) {
        return { id, name: 'Mocked User' }
      }
    }

    beforeEach(() => {
      getContainer().registerSingleton(UserService)
      getContainer('test-scope').registerSingleton(UserService)
    })

    it('isMocked() checks mock status in scope', () => {
      getContainer('test-scope').registerMock(UserService, MockUserService)
      
      expect(isMocked(UserService, { scope: 'test-scope' })).toBe(true)
      expect(isMocked(UserService)).toBe(false) // default not mocked
    })

    it('removeMock() removes mock from specific scope', () => {
      getContainer('test-scope').registerMock(UserService, MockUserService)
      
      removeMock(UserService, { scope: 'test-scope' })
      
      expect(isMocked(UserService, { scope: 'test-scope' })).toBe(false)
    })

    it('removeAllMocks() removes mocks from specific scope', () => {
      getContainer('test-scope').registerMock(UserService, MockUserService)
      getContainer().registerMock(UserService, MockUserService)
      
      removeAllMocks({ scope: 'test-scope' })
      
      expect(isMocked(UserService, { scope: 'test-scope' })).toBe(false)
      expect(isMocked(UserService)).toBe(true) // default still mocked
    })

    it('getMockInstance() returns mock from scope', () => {
      getContainer('test-scope').registerMock(UserService, MockUserService)
      
      const mock = getMockInstance(UserService, { scope: 'test-scope' })
      
      expect(mock.getUser(1).name).toBe('Mocked User')
    })
  })

  describe('resetSingletons() with scope', () => {
    it('resets singletons only in specified scope', () => {
      getContainer().registerSingleton(UserService)
      getContainer('scope-a').registerSingleton(UserService)
      
      // Resolve to create instances
      const defaultUser = resolve(UserService)
      const scopeUser = resolve(UserService, { scope: 'scope-a' })
      
      // Reset only scope-a
      resetSingletons({ scope: 'scope-a' })
      
      // Default should still have same instance
      expect(resolve(UserService)).toBe(defaultUser)
      // Scope should have new instance
      expect(resolve(UserService, { scope: 'scope-a' })).not.toBe(scopeUser)
    })
  })

  describe('clearContainer() with scope', () => {
    it('clears only the specified scope', () => {
      getContainer().registerSingleton(UserService)
      getContainer('to-clear').registerSingleton(AuthService)
      
      clearContainer({ scope: 'to-clear' })
      
      expect(isRegistered(UserService)).toBe(true) // default untouched
      expect(isRegistered(AuthService, { scope: 'to-clear' })).toBe(false)
    })

    it('supports preserveRegistrations option', () => {
      getContainer('my-scope').registerSingleton(UserService)
      resolve(UserService, { scope: 'my-scope' }) // create instance
      
      clearContainer({ scope: 'my-scope', preserveRegistrations: true })
      
      // Registration still there
      expect(isRegistered(UserService, { scope: 'my-scope' })).toBe(true)
      // But instance cleared (will create new one)
      const regs = listRegistrations({ scope: 'my-scope' })
      expect(regs[0].hasInstance).toBe(false)
    })
  })

  describe('unregister() with scope', () => {
    it('unregisters from specified scope only', () => {
      getContainer().registerSingleton(UserService)
      getContainer('scope-x').registerSingleton(UserService)
      
      unregister(UserService, { scope: 'scope-x' })
      
      expect(isRegistered(UserService)).toBe(true)
      // After unregister, scope-x no longer has its OWN registration,
      // but has() still returns true because parent has it.
      // To check direct registration, use the container's has() with checkParent=false
      expect(getContainer('scope-x').has(UserService, false)).toBe(false)
      // But isRegistered still returns true because it's available via parent
      expect(isRegistered(UserService, { scope: 'scope-x' })).toBe(true)
    })
  })

  describe('listRegistrations() with scope', () => {
    it('lists registrations from specified scope', () => {
      getContainer('list-scope').registerSingleton(UserService)
      getContainer('list-scope').registerFactory(AuthService)
      
      const registrations = listRegistrations({ scope: 'list-scope' })
      
      expect(registrations).toHaveLength(2)
      expect(registrations.map(r => r.type)).toContain('singleton')
      expect(registrations.map(r => r.type)).toContain('factory')
    })
  })

  describe('validateRegistrations() with scope', () => {
    it('validates in specified scope', () => {
      getContainer('validate-scope').registerSingleton(UserService)
      
      // Should not throw
      expect(() => validateRegistrations(UserService, { scope: 'validate-scope' }))
        .not.toThrow()
      
      // Should throw for missing
      expect(() => validateRegistrations(AuthService, { scope: 'validate-scope' }))
        .toThrow(/Missing registrations.*"validate-scope"/)
    })

    it('includes scope name in error message', () => {
      expect(() => validateRegistrations(UserService, { scope: 'my-named-scope' }))
        .toThrow('in scope "my-named-scope"')
    })
  })

  describe('setDebug() with scope', () => {
    it('enables debug for specific scope', () => {
      const container = getContainer('debug-scope')
      const spy = jest.spyOn(console, 'log').mockImplementation()
      
      setDebug(true, { scope: 'debug-scope' })
      container.registerSingleton(UserService)
      
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('[DI]'))
      spy.mockRestore()
    })
  })

  describe('Multi-tenant scenario', () => {
    class TenantConfig {
      constructor(tenantId) {
        this.tenantId = tenantId
      }
    }

    it('isolates tenant data completely', () => {
      // Setup tenants
      const tenants = ['acme', 'globex', 'initech']
      
      for (const tenant of tenants) {
        const container = getContainer(`tenant:${tenant}`)
        container.registerSingleton(TenantConfig)
      }
      
      // Each tenant resolves their own isolated config
      const acmeConfig = resolve(TenantConfig, 'acme', { scope: 'tenant:acme' })
      const globexConfig = resolve(TenantConfig, 'globex', { scope: 'tenant:globex' })
      
      expect(acmeConfig.tenantId).toBe('acme')
      expect(globexConfig.tenantId).toBe('globex')
      expect(acmeConfig).not.toBe(globexConfig)
      
      // Cleanup one tenant doesn't affect others
      destroyContainer('tenant:acme')
      
      expect(hasContainer('tenant:acme')).toBe(false)
      expect(hasContainer('tenant:globex')).toBe(true)
      
      // Globex still works
      expect(resolve(TenantConfig, { scope: 'tenant:globex' }).tenantId).toBe('globex')
    })
  })

  describe('Transaction scope scenario', () => {
    class DbConnection {
      static counter = 0
      constructor() {
        this.id = ++DbConnection.counter
      }
    }

    beforeEach(() => {
      DbConnection.counter = 0
    })

    it('provides transaction-scoped connections', () => {
      // Simulate transaction scope
      const txId = 'tx-12345'
      const txContainer = getContainer(`transaction:${txId}`)
      txContainer.registerSingleton(DbConnection)
      
      // Multiple resolves in same transaction get same connection
      const conn1 = resolve(DbConnection, { scope: `transaction:${txId}` })
      const conn2 = resolve(DbConnection, { scope: `transaction:${txId}` })
      
      expect(conn1.id).toBe(conn2.id)
      
      // Different transaction gets different connection
      const txId2 = 'tx-67890'
      getContainer(`transaction:${txId2}`).registerSingleton(DbConnection)
      const conn3 = resolve(DbConnection, { scope: `transaction:${txId2}` })
      
      expect(conn3.id).not.toBe(conn1.id)
      
      // Cleanup after transaction completes
      destroyContainer(`transaction:${txId}`)
      destroyContainer(`transaction:${txId2}`)
    })
  })

  describe('Backward compatibility', () => {
    beforeEach(() => {
      getContainer().registerSingleton(UserService)
    })

    it('all functions work without scope option', () => {
      // These should all work as before
      expect(resolve(UserService)).toBeInstanceOf(UserService)
      expect(isRegistered(UserService)).toBe(true)
      expect(listRegistrations()).toHaveLength(1)
      expect(() => validateRegistrations(UserService)).not.toThrow()
    })

    it('getContainer() without args returns default container', () => {
      const container = getContainer()
      expect(container.has(UserService)).toBe(true)
    })
  })

  describe('Object-keyed containers (WeakMap)', () => {
    it('getContainer(object) creates a new container', () => {
      const key = { name: 'test-key' }
      const container = getContainer(key)
      
      expect(container).toBeDefined()
      expect(container[Symbol.toStringTag]).toBe('Container')
    })

    it('same object key returns same container', () => {
      const key = {}
      const container1 = getContainer(key)
      const container2 = getContainer(key)
      
      expect(container1).toBe(container2)
    })

    it('different object keys create different containers', () => {
      const key1 = {}
      const key2 = {}
      const container1 = getContainer(key1)
      const container2 = getContainer(key2)
      
      expect(container1).not.toBe(container2)
    })

    it('object-keyed containers are isolated from each other', () => {
      const key1 = { id: 1 }
      const key2 = { id: 2 }
      
      getContainer(key1).registerSingleton(UserService)
      
      expect(getContainer(key1).has(UserService)).toBe(true)
      expect(getContainer(key2).has(UserService)).toBe(false)
    })

    it('object-keyed containers have default container as parent', () => {
      // Register in default container
      getContainer().registerSingleton(UserService)
      
      const key = { request: true }
      const container = getContainer(key)
      
      // Container should inherit from default via parent
      expect(container.parent).toBe(getContainer())
    })

    it('object-keyed containers can resolve from parent (auto-registration)', () => {
      // Register in default container
      getContainer().registerSingleton(UserService)
      
      const key = {}
      const instance = resolve(UserService, { scope: key })
      
      expect(instance).toBeInstanceOf(UserService)
    })

    it('hasContainer(object) works for object keys', () => {
      const key = {}
      expect(hasContainer(key)).toBe(false)
      
      getContainer(key)
      expect(hasContainer(key)).toBe(true)
    })

    it('destroyContainer(object) removes object-keyed containers', () => {
      const key = {}
      getContainer(key).registerSingleton(UserService)
      
      expect(hasContainer(key)).toBe(true)
      const result = destroyContainer(key)
      
      expect(result).toBe(true)
      expect(hasContainer(key)).toBe(false)
    })

    it('resolve() with object scope works', () => {
      const key = {}
      getContainer(key).registerSingleton(UserService)
      
      const instance = resolve(UserService, { scope: key })
      expect(instance).toBeInstanceOf(UserService)
    })

    it('isRegistered() with object scope works', () => {
      const key = {}
      getContainer(key).registerSingleton(UserService)
      
      expect(isRegistered(UserService, { scope: key })).toBe(true)
      expect(isRegistered(AuthService, { scope: key })).toBe(false)
    })

    it('clearContainer() with object scope works', () => {
      const key = {}
      getContainer(key).registerSingleton(UserService)
      
      clearContainer({ scope: key })
      expect(getContainer(key).has(UserService)).toBe(false)
    })

    it('listContainers() does NOT include object-keyed containers', () => {
      // Object keys can't be listed (WeakMap has no enumeration)
      const key = {}
      getContainer(key)
      getContainer('string-key')
      
      const list = listContainers()
      expect(list).toContain('string-key')
      expect(list).not.toContain(key) // Objects not in list
      expect(list.length).toBe(1)
    })

    it('mixing string and object keys works independently', () => {
      const stringKey = 'my-scope'
      const objectKey = { id: 'request-123' }
      
      getContainer(stringKey).registerSingleton(UserService)
      getContainer(objectKey).registerSingleton(AuthService)
      
      expect(isRegistered(UserService, { scope: stringKey })).toBe(true)
      expect(isRegistered(AuthService, { scope: stringKey })).toBe(false)
      
      expect(isRegistered(AuthService, { scope: objectKey })).toBe(true)
      expect(isRegistered(UserService, { scope: objectKey })).toBe(false)
    })

    it('request-like object as container key example', () => {
      // Simulates using a request object as the container key
      const request = { 
        method: 'GET', 
        url: '/api/users',
        headers: { authorization: 'Bearer token' }
      }
      
      // Register services in the request-scoped container
      getContainer(request).registerSingleton(UserService)
      
      // Resolve within request context
      const user = resolve(UserService, { scope: request })
      expect(user).toBeInstanceOf(UserService)
      
      // Different request has its own container
      const request2 = { method: 'POST', url: '/api/users' }
      expect(isRegistered(UserService, { scope: request2 })).toBe(false)
      
      // Cleanup (in real usage, GC handles this automatically)
      destroyContainer(request)
    })
  })
})
