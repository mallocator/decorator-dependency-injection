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
 * @param {string|Function} clazzOrName The singleton or factory class or name
 * @param {...*} params Parameters to pass to the constructor. Recommended to use only with factories.
 * @returns {(function(*, {kind: string, name: string}): function(): Object)}
 * @example @Inject(MySingleton) mySingleton
 * @example @Inject("myCustomName") myFactory
 * @throws {Error} If the injection target is not a field
 * @throws {Error} If the injected field is assigned a value
 */
export function Inject(clazzOrName, ...params) {
  return function (_, context) {
    if (context.kind !== 'field') {
      throw new Error('Invalid injection target')
    }
    return function (initialValue) {
      if (initialValue) {
        throw new Error('Cannot assign value to injected field')
      }
      const instanceContext = defaultContainer.getContext(clazzOrName)
      return defaultContainer.getInstance(instanceContext, params)
    }
  }
}

/**
 * Inject a singleton or factory instance lazily into a class field. You can also provide parameters to the constructor.
 * If the instance is a singleton, it will only be created once with the first set of parameters it encounters.
 *
 * @param {string|Function} clazzOrName The singleton or factory class or name
 * @param {...*} params Parameters to pass to the constructor. Recommended to use only with factories.
 * @returns {(function(*, {kind: string, name: string, addInitializer: Function}): void)}
 * @example @InjectLazy(MySingleton) mySingleton
 * @example @InjectLazy("myCustomName") myFactory
 * @throws {Error} If the injection target is not a field
 * @throws {Error} If the injected field is assigned a value
 */
export function InjectLazy(clazzOrName, ...params) {
  const cache = new WeakMap()
  return (_, context) => {
    if (context.kind !== 'field') {
      throw new Error('Invalid injection target')
    }
    context.addInitializer(function () {
      Object.defineProperty(this, context.name, {
        get() {
          if (!cache.has(this)) {
            const instanceContext = defaultContainer.getContext(clazzOrName)
            const value = defaultContainer.getInstance(instanceContext, params)
            cache.set(this, value)
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

// Export Container class for advanced use cases (e.g., isolated containers)
export {Container}

// Export createProxy for advanced proxy use cases
export {createProxy} from './src/proxy.js'
