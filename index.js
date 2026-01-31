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
      if (!cache.has(this)) {
        cache.set(this, getValue())
      }
      return cache.get(this)
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
  return function (clazz, context) {
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
  return function (clazz, context) {
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
  return function (_, context) {
    const getValue = () => {
      const instanceContext = defaultContainer.getContext(clazzOrName)
      return defaultContainer.getInstance(instanceContext, params)
    }

    if (context.kind === 'field') {
      return function (initialValue) {
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
        return function (initialValue) {
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
 * Mark a class as a mock. This will replace the class with a mock instance when injected.
 *
 * @param {string|Function} mockedClazzOrName The singleton or factory class or name to be mocked
 * @param {boolean} [proxy=false] If true, the mock will proxy to the original class.
 *                                Any methods not defined in the mock will be called on the original class.
 * @returns {(function(Function, {kind: string}): void)}
 * @example @Mock(MySingleton) class MyMock {}
 * @example @Mock("myCustomName", true) class MyMock {}
 * @throws {Error} If the injection target is not a class
 * @throws {Error} If the injection source is not found
 */
export function Mock(mockedClazzOrName, proxy = false) {
  return function (clazz, context) {
    if (context.kind !== 'class') {
      throw new Error('Invalid injection target')
    }
    defaultContainer.registerMock(mockedClazzOrName, clazz, proxy)
  }
}

/**
 * Reset all mocks to their original classes.
 */
export function resetMocks() {
  defaultContainer.resetAllMocks()
}

/**
 * Reset a specific mock to its original class.
 *
 * @param {string|Function} clazzOrName The singleton or factory class or name to reset
 */
export function resetMock(clazzOrName) {
  defaultContainer.resetMock(clazzOrName)
}

/**
 * Clear all registered instances and mocks from the container.
 * Useful for complete test isolation between test suites.
 */
export function clearContainer() {
  defaultContainer.clear()
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

// Export Container class for advanced use cases (e.g., isolated containers)
export {Container}

// Export createProxy for advanced proxy use cases
export {createProxy} from './src/proxy.js'
