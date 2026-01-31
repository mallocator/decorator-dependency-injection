import {
  Singleton,
  Factory,
  resolve,
  clearContainer,
  getContainer
} from '../index.js'

describe('resolve', () => {
  afterEach(() => {
    clearContainer()
  })

  describe('with singletons', () => {
    it('should resolve a singleton by class', () => {
      @Singleton()
      class UserService {
        name = 'UserService'
      }

      const instance = resolve(UserService)
      expect(instance).toBeInstanceOf(UserService)
      expect(instance.name).toBe('UserService')
    })

    it('should return the same instance for singletons', () => {
      @Singleton()
      class DatabaseService {}

      const instance1 = resolve(DatabaseService)
      const instance2 = resolve(DatabaseService)

      expect(instance1).toBe(instance2)
    })

    it('should resolve a singleton by name', () => {
      @Singleton('myService')
      class NamedService {
        getValue() {
          return 42
        }
      }

      const instance = resolve('myService')
      expect(instance.getValue()).toBe(42)
    })
  })

  describe('with factories', () => {
    it('should resolve a factory by class', () => {
      @Factory()
      class RequestHandler {}

      const instance = resolve(RequestHandler)
      expect(instance).toBeInstanceOf(RequestHandler)
    })

    it('should create new instances for factories', () => {
      @Factory()
      class TransientService {}

      const instance1 = resolve(TransientService)
      const instance2 = resolve(TransientService)

      expect(instance1).not.toBe(instance2)
    })

    it('should pass parameters to factory constructor', () => {
      @Factory()
      class Logger {
        constructor(prefix) {
          this.prefix = prefix
        }
      }

      const logger1 = resolve(Logger, 'app')
      const logger2 = resolve(Logger, 'db')

      expect(logger1.prefix).toBe('app')
      expect(logger2.prefix).toBe('db')
    })

    it('should resolve a factory by name with parameters', () => {
      @Factory('loggerFactory')
      class Logger {
        constructor(module, level) {
          this.module = module
          this.level = level
        }
      }

      const logger = resolve('loggerFactory', 'auth', 'debug')
      expect(logger.module).toBe('auth')
      expect(logger.level).toBe('debug')
    })
  })

  describe('error handling', () => {
    it('should throw for unregistered class', () => {
      class UnregisteredService {}

      expect(() => resolve(UnregisteredService)).toThrow(
        /Cannot find injection source/
      )
    })

    it('should throw for unregistered name', () => {
      expect(() => resolve('nonexistent')).toThrow(
        /Cannot find injection source/
      )
    })
  })

  describe('use cases', () => {
    it('should work in a plain function', () => {
      @Singleton()
      class ConfigService {
        getConfig() {
          return { apiUrl: 'https://api.example.com' }
        }
      }

      // Simulate using resolve in a plain function
      function getApiUrl() {
        const config = resolve(ConfigService)
        return config.getConfig().apiUrl
      }

      expect(getApiUrl()).toBe('https://api.example.com')
    })

    it('should work with container resolve method directly', () => {
      @Singleton('config')
      class ConfigService {
        dbHost = 'localhost'
      }

      const container = getContainer()
      const config = container.resolve('config')

      expect(config.dbHost).toBe('localhost')
    })

    it('should work with multiple resolves in sequence', () => {
      @Singleton()
      class AuthService {
        isAuthenticated() {
          return true
        }
      }

      @Singleton()
      class UserService {
        getUser() {
          return { id: 1, name: 'John' }
        }
      }

      function handleRequest() {
        const auth = resolve(AuthService)
        if (!auth.isAuthenticated()) {
          return null
        }
        const users = resolve(UserService)
        return users.getUser()
      }

      expect(handleRequest()).toEqual({ id: 1, name: 'John' })
    })
  })
})
