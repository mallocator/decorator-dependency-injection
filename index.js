/**
 * Decorator Dependency Injection
 *
 * A simple library for dependency injection using TC39 Stage 3 decorators.
 *
 * @module decorator-dependency-injection
 */

import {Container} from './src/Container.js'

/** @type {Container} The default global container */
const defaultContainer = new Container()

/**
 * Creates a lazy accessor descriptor with WeakMap-based caching.
 * @param {WeakMap} cache - WeakMap for per-instance caching
 * @param {Function} getValue - Factory function to create the value
 * @param {string} name - The accessor name for error messages
 * @returns {{init: Function, get: Function, set: Function}} Accessor descriptor
 * @private
 */
function createLazyAccessor(cache, getValue, name) {
  return {
    init(initialValue) {
      if (initialValue) {
        throw new Error(`Cannot assign value to injected accessor "${name}"`)
      }
      return undefined
    },
    get() {
      return cache.get(this) ?? (cache.set(this, getValue()), cache.get(this))
    },
    set() {
      throw new Error(`Cannot assign value to injected accessor "${name}"`)
    }
  }
}

/**
 * Register a class as a singleton. If a name is provided, it will be used as the key in the singleton map.
 * Singleton instances only ever have one instance created via the @Inject decorator.
 *
 * @param {string} [name] The name of the singleton. If not provided, the class will be used as the key.
 * @returns {(function(Function, {kind: string}): void)}
 * @example @Singleton() class MySingleton {}
 * @example @Singleton('customName') class MySingleton {}
 * @throws {Error} If the injection target is not a class
 * @throws {Error} If a singleton or factory with the same name is already defined
 * @throws {Error} If the target is not a class constructor
 */
export function Singleton(name) {
  return (clazz, context) => {
    if (context.kind !== 'class') {
      throw new Error('Invalid injection target')
    }
    if (typeof clazz !== 'function' || !clazz.prototype) {
      throw new Error('Target must be a class constructor')
    }
    defaultContainer.registerSingleton(clazz, name)
  }
}

/**
 * Register a class as a factory. If a name is provided, it will be used as the key in the factory map.
 * Factory instances are created via the @Inject decorator. Each call to the factory will create a new instance.
 *
 * @param {string} [name] The name of the factory. If not provided, the class will be used as the key.
 * @returns {(function(Function, {kind: string}): void)}
 * @example @Factory() class MyFactory {}
 * @example @Factory('customName') class MyFactory {}
 * @throws {Error} If the injection target is not a class
 * @throws {Error} If a factory or singleton with the same name is already defined
 * @throws {Error} If the target is not a class constructor
 */
export function Factory(name) {
  return (clazz, context) => {
    if (context.kind !== 'class') {
      throw new Error('Invalid injection target')
    }
    if (typeof clazz !== 'function' || !clazz.prototype) {
      throw new Error('Target must be a class constructor')
    }
    defaultContainer.registerFactory(clazz, name)
  }
}

/**
 * Inject a singleton or factory instance into a class field. You can also provide parameters to the constructor.
 * If the instance is a singleton, it will only be created once with the first set of parameters it encounters.
 *
 * Supports:
 * - Public fields: @Inject(MyClass) myField
 * - Private fields: @Inject(MyClass) #myField
 * - Accessors: @Inject(MyClass) accessor myField
 * - Private accessors: @Inject(MyClass) accessor #myField
 *
 * @param {string|Function} clazzOrName The singleton or factory class or name
 * @param {...*} params Parameters to pass to the constructor. Recommended to use only with factories.
 * @returns {(function(*, {kind: string, name: string}): function(): Object)}
 * @example @Inject(MySingleton) mySingleton
 * @example @Inject("myCustomName") myFactory
 * @example @Inject(MyService) #privateService
 * @example @Inject(MyService) accessor myService
 * @throws {Error} If the injection target is not a field or accessor
 * @throws {Error} If the injected field is assigned a value
 */
export function Inject(clazzOrName, ...params) {
  return (_, context) => {
    const getValue = () => {
      const instanceContext = defaultContainer.getContext(clazzOrName)
      return defaultContainer.getInstance(instanceContext, params)
    }

    if (context.kind === 'field') {
      return (initialValue) => {
        if (initialValue) {
          throw new Error(`Cannot assign value to injected field "${context.name}"`)
        }
        return getValue()
      }
    }

    if (context.kind === 'accessor') {
      const cache = new WeakMap()
      return createLazyAccessor(cache, getValue, context.name)
    }

    throw new Error('Invalid injection target: @Inject can only be used on fields or accessors')
  }
}

/**
 * Inject a singleton or factory instance lazily into a class field. You can also provide parameters to the constructor.
 * If the instance is a singleton, it will only be created once with the first set of parameters it encounters.
 *
 * The lazy injection defers instantiation until the field is first accessed. This is useful for:
 * - Breaking circular dependencies
 * - Deferring expensive initializations
 *
 * Supports:
 * - Public fields: @InjectLazy(MyClass) myField
 * - Private fields: @InjectLazy(MyClass) #myField
 * - Accessors: @InjectLazy(MyClass) accessor myField
 * - Private accessors: @InjectLazy(MyClass) accessor #myField
 *
 * Note: For private fields, the lazy behavior is achieved through the field initializer
 * returning a getter-based proxy. For accessors, it's achieved through the accessor's
 * get/set methods directly.
 *
 * @param {string|Function} clazzOrName The singleton or factory class or name
 * @param {...*} params Parameters to pass to the constructor. Recommended to use only with factories.
 * @returns {(function(*, {kind: string, name: string, addInitializer: Function}): void)}
 * @example @InjectLazy(MySingleton) mySingleton
 * @example @InjectLazy("myCustomName") myFactory
 * @example @InjectLazy(MyService) #privateService
 * @throws {Error} If the injection target is not a field or accessor
 * @throws {Error} If the injected field is assigned a value
 */
export function InjectLazy(clazzOrName, ...params) {
  const cache = new WeakMap()

  const getValue = () => {
    const instanceContext = defaultContainer.getContext(clazzOrName)
    return defaultContainer.getInstance(instanceContext, params)
  }

  return (_, context) => {
    if (context.kind === 'field') {
      // For private fields, we cannot use Object.defineProperty to create a lazy getter.
      // Instead, we eagerly create the value. For true lazy behavior, use accessor syntax.
      if (context.private) {
        return (initialValue) => {
          if (initialValue) {
            throw new Error(`Cannot assign value to lazy-injected field "${context.name}"`)
          }
          return getValue()
        }
      }

      // For public fields, use Object.defineProperty for true lazy behavior
      context.addInitializer(function () {
        Object.defineProperty(this, context.name, {
          get() {
            if (!cache.has(this)) {
              cache.set(this, getValue())
            }
            return cache.get(this)
          },
          set() {
            throw new Error(`Cannot assign value to lazy-injected field "${context.name}"`)
          },
          configurable: true,
          enumerable: true
        })
      })
      return
    }

    if (context.kind === 'accessor') {
      return createLazyAccessor(cache, getValue, context.name)
    }

    throw new Error('Invalid injection target: @InjectLazy can only be used on fields or accessors')
  }
}

/**
 * Mark a class as a mock. This will replace the original class with the mock when injected.
 * The mock registration persists until explicitly removed with removeMock() or removeAllMocks().
 *
 * @param {string|Function} mockedClazzOrName The singleton or factory class or name to be mocked
 * @param {boolean} [proxy=false] If true, the mock will proxy to the original class.
 *                                Any methods not defined in the mock will be called on the original class.
 * @returns {(function(Function, {kind: string}): void)}
 * 
 * @example Basic mocking
 * ```js
 * @Mock(MySingleton)
 * class MockedSingleton {
 *   doSomething() { return 'mocked result' }
 * }
 * ```
 * 
 * @example Proxy mocking (partial mock)
 * ```js
 * // Only override specific methods, others delegate to original
 * @Mock(MySingleton, true)
 * class PartialMock {
 *   onlyThisMethod() { return 'mocked' }
 *   // All other methods call the original implementation
 * }
 * ```
 * 
 * @example Testing pattern with hoisted mock functions
 * ```js
 * // Hoist mock functions for per-test configuration
 * const mockMethod = vi.hoisted(() => vi.fn())
 * 
 * @Mock(MyService)
 * class MockMyService {
 *   doSomething = mockMethod
 * }
 * 
 * beforeEach(() => {
 *   // Clear call history - NOT removeMock() which removes the mock entirely
 *   mockMethod.mockClear()
 * })
 * 
 * it('should call the service', () => {
 *   mockMethod.mockReturnValue('test value')
 *   // ... your test
 *   expect(mockMethod).toHaveBeenCalled()
 * })
 * ```
 * 
 * @example Cleanup in afterEach
 * ```js
 * afterEach(() => {
 *   // Option 1: Remove all mocks and restore originals
 *   removeAllMocks()
 *   
 *   // Option 2: Just clear singleton instances, keep mocks registered
 *   resetSingletons()
 * })
 * ```
 * 
 * @throws {Error} If the injection target is not a class
 * @throws {Error} If the injection source is not found
 */
export function Mock(mockedClazzOrName, proxy = false) {
  return (clazz, context) => {
    if (context.kind !== 'class') {
      throw new Error('Invalid injection target')
    }
    defaultContainer.registerMock(mockedClazzOrName, clazz, proxy)
  }
}

/**
 * Remove all mocks and restore original classes.
 * This completely removes all mocks - it does NOT clear mock call history.
 * 
 * If you want to clear call history on mock functions without removing the mock,
 * call mockClear() on your mock functions instead.
 * 
 * @example
 * ```js
 * afterEach(() => {
 *   removeAllMocks() // Restores original classes
 * })
 * ```
 */
export function removeAllMocks() {
  defaultContainer.removeAllMocks()
}

/**
 * Remove a specific mock and restore the original class.
 * This completely removes the mock - it does NOT clear mock call history.
 *
 * @param {string|Function} clazzOrName The singleton or factory class or name to restore
 * 
 * @example
 * ```js
 * removeMock(UserService) // Restores original UserService
 * ```
 */
export function removeMock(clazzOrName) {
  defaultContainer.removeMock(clazzOrName)
}

/**
 * @deprecated Use removeAllMocks() instead. This will be removed in a future version.
 * 
 * WARNING: Despite the name, this does NOT reset mock call history like mockClear().
 * It completely removes all mocks and restores the original classes.
 */
export function resetMocks() {
  console.warn(
    '[DI] resetMocks() is deprecated. Use removeAllMocks() instead. ' +
    'Note: This removes mocks entirely, NOT clearing call history.'
  )
  defaultContainer.removeAllMocks()
}

/**
 * @deprecated Use removeMock() instead. This will be removed in a future version.
 * 
 * WARNING: Despite the name, this does NOT reset mock call history like mockClear().
 * It completely removes the mock and restores the original class.
 *
 * @param {string|Function} clazzOrName The singleton or factory class or name to restore
 */
export function resetMock(clazzOrName) {
  console.warn(
    '[DI] resetMock() is deprecated. Use removeMock() instead. ' +
    'Note: This removes the mock entirely, NOT clearing call history.'
  )
  defaultContainer.removeMock(clazzOrName)
}

/**
 * Reset singleton instances without removing registrations.
 * This clears cached singleton instances so they will be recreated on next resolve.
 * Mock registrations are preserved by default.
 * 
 * This is ideal for test isolation where you want:
 * - Fresh singleton instances per test
 * - Mock registrations to remain intact
 * 
 * @param {Object} [options] Options for resetting
 * @param {boolean} [options.preserveMocks=true] If true, keeps mock registrations.
 *                                                If false, also removes mocks.
 * 
 * @example
 * ```js
 * beforeEach(() => {
 *   // Each test gets fresh singleton instances
 *   // but mocks remain registered
 *   resetSingletons()
 * })
 * ```
 */
export function resetSingletons(options) {
  defaultContainer.resetSingletons(options)
}

/**
 * Clear all registered instances and mocks from the container.
 * 
 * By default, this removes ALL registrations including @Singleton and @Factory classes.
 * For just clearing singleton instances without removing any registrations,
 * use resetSingletons() instead.
 * 
 * @param {Object} [options] Options for clearing
 * @param {boolean} [options.preserveRegistrations=false] If true, keeps all registrations but clears cached instances.
 * 
 * @example
 * ```js
 * // Complete reset - removes everything
 * clearContainer()
 * 
 * // Clear cached instances but keep registrations (including mocks)
 * clearContainer({ preserveRegistrations: true })
 * 
 * // Just clear singleton instances (preferred for test isolation)
 * resetSingletons()
 * ```
 */
export function clearContainer(options) {
  defaultContainer.clear(options)
}

/**
 * Get the default container instance.
 * Useful for advanced use cases or testing the container itself.
 *
 * @returns {Container} The default container
 */
export function getContainer() {
  return defaultContainer
}

/**
 * Enable or disable debug logging for dependency injection.
 * When enabled, logs when instances are registered, created, and mocked.
 *
 * @param {boolean} enabled Whether to enable debug mode
 * @example
 * setDebug(true)
 * // [DI] Registered singleton: UserService
 * // [DI] Creating singleton: UserService
 */
export function setDebug(enabled) {
  defaultContainer.setDebug(enabled)
}

/**
 * Check if a class or name is registered in the default container.
 * Useful for validation before injection.
 *
 * @param {string|Function} clazzOrName The class or name to check
 * @returns {boolean} true if registered, false otherwise
 * @example
 * if (!isRegistered(MyService)) {
 *   console.warn('MyService not registered!')
 * }
 */
export function isRegistered(clazzOrName) {
  return defaultContainer.has(clazzOrName)
}

/**
 * Validate that all provided injection tokens are registered.
 * Throws an error with details about missing registrations.
 * Useful for fail-fast validation at application startup.
 *
 * @param {...(string|Function)} tokens Classes or names to validate
 * @throws {Error} If any token is not registered
 * @example
 * // At app startup:
 * validateRegistrations(UserService, AuthService, 'databaseConnection')
 */
export function validateRegistrations(...tokens) {
  const missing = tokens.filter(token => !defaultContainer.has(token))
  if (missing.length > 0) {
    const names = missing.map(t => typeof t === 'string' ? t : t.name).join(', ')
    throw new Error(
      `Missing registrations: [${names}]. ` +
      `Ensure these classes are decorated with @Singleton() or @Factory() before use.`
    )
  }
}

/**
 * Resolve and return an instance by class or name.
 * This allows non-decorator code (plain functions, modules, etc.) to retrieve
 * instances from the DI container.
 *
 * @template T
 * @param {string|Function} clazzOrName The class or name to resolve
 * @param {...*} params Parameters to pass to the constructor
 * @returns {T} The resolved instance
 * @throws {Error} If the class or name is not registered
 * @example
 * // In a plain function:
 * function handleRequest(req) {
 *   const userService = resolve(UserService)
 *   return userService.getUser(req.userId)
 * }
 * @example
 * // With a named registration:
 * const db = resolve('database')
 * @example
 * // With factory parameters:
 * const logger = resolve(Logger, 'my-module')
 */
export function resolve(clazzOrName, ...params) {
  return defaultContainer.resolve(clazzOrName, ...params)
}

/**
 * Get the mock instance for a mocked class.
 * This is useful when you need to access or configure mock behavior dynamically in tests.
 * 
 * Unlike resolve(), this explicitly checks that the class is mocked and provides
 * better error messages if it's not.
 *
 * @template T
 * @param {string|Function} clazzOrName The original class or name that was mocked
 * @param {...*} params Parameters to pass to the constructor
 * @returns {T} The mock instance
 * @throws {Error} If the class is not registered
 * @throws {Error} If the class is not mocked
 * 
 * @example
 * ```js
 * @Mock(UserService)
 * class MockUserService {
 *   getUser = vi.fn()
 * }
 * 
 * it('should get user', () => {
 *   const mock = getMockInstance(UserService)
 *   mock.getUser.mockReturnValue({ id: 1, name: 'Test' })
 *   
 *   // ... test code that uses UserService
 *   
 *   expect(mock.getUser).toHaveBeenCalledWith(1)
 * })
 * ```
 */
export function getMockInstance(clazzOrName, ...params) {
  return defaultContainer.getMockInstance(clazzOrName, ...params)
}

/**
 * Check if a class or name has a mock registered.
 * Useful for conditional test logic or debugging.
 *
 * @param {string|Function} clazzOrName The class or name to check
 * @returns {boolean} true if a mock is registered, false otherwise
 * 
 * @example
 * ```js
 * if (isMocked(UserService)) {
 *   console.log('UserService is mocked')
 * }
 * ```
 */
export function isMocked(clazzOrName) {
  return defaultContainer.isMocked(clazzOrName)
}

/**
 * Unregister a class or name from the container.
 * This removes the registration entirely, including any mock.
 * 
 * @param {string|Function} clazzOrName The class or name to unregister
 * @returns {boolean} true if the registration was removed, false if it wasn't registered
 * 
 * @example
 * ```js
 * unregister(MyService) // Returns true if was registered
 * ```
 */
export function unregister(clazzOrName) {
  return defaultContainer.unregister(clazzOrName)
}

/**
 * List all registrations in the container.
 * Useful for debugging and introspection.
 * 
 * @returns {Array<{key: string|Function, name: string, type: 'singleton'|'factory', isMocked: boolean, hasInstance: boolean}>}
 * 
 * @example
 * ```js
 * listRegistrations().forEach(reg => {
 *   console.log(`${reg.name}: ${reg.type}, mocked: ${reg.isMocked}`)
 * })
 * ```
 */
export function listRegistrations() {
  return defaultContainer.list()
}

// Export Container class for advanced use cases (e.g., isolated containers)
export {Container}

// Export createProxy for advanced proxy use cases
export {createProxy} from './src/proxy.js'
