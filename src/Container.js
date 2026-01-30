/**
 * @typedef {Object} InstanceContext
 * @property {'singleton'|'factory'} type - The type of the instance.
 * @property {Function} clazz - The class constructor for the instance.
 * @property {Function} [originalClazz] - The original class if this is a mock.
 * @property {Object} [instance] - The singleton instance, if created.
 * @property {Object} [originalInstance] - The original instance if this is a mock.
 * @property {boolean} [proxy=false] - If true, the mock will proxy to the original class for undefined methods/properties.
 */

import {createProxy} from './proxy.js'

/**
 * A dependency injection container that manages singleton and factory instances.
 * Supports mocking for testing purposes.
 */
export class Container {
  /** @type {Map<string|Function, InstanceContext>} */
  #instances = new Map()

  /** @type {boolean} Enable debug logging */
  #debug = false

  /**
   * Enable or disable debug logging.
   * When enabled, logs when instances are created.
   * @param {boolean} enabled Whether to enable debug mode
   */
  setDebug(enabled) {
    this.#debug = enabled
  }

  /**
   * Log a debug message if debug mode is enabled.
   * @param {string} message The message to log
   * @private
   */
  #log(message) {
    if (this.#debug) {
      console.log(`[DI] ${message}`)
    }
  }

  /**
   * Register a class as a singleton.
   * @param {Function} clazz The class constructor
   * @param {string} [name] Optional name key
   */
  registerSingleton(clazz, name) {
    this.#register(clazz, 'singleton', name)
  }

  /**
   * Register a class as a factory.
   * @param {Function} clazz The class constructor
   * @param {string} [name] Optional name key
   */
  registerFactory(clazz, name) {
    this.#register(clazz, 'factory', name)
  }

  /**
   * Internal registration logic.
   * @param {Function} clazz The class constructor
   * @param {'singleton'|'factory'} type The registration type
   * @param {string} [name] Optional name key
   * @private
   */
  #register(clazz, type, name) {
    const key = name ?? clazz
    if (this.#instances.has(key)) {
      throw new Error(
        'A different class is already registered under this name. ' +
        'This may be a circular dependency. Try using @InjectLazy'
      )
    }
    this.#instances.set(key, {clazz, type})
    this.#log(`Registered ${type}: ${name || clazz.name}`)
  }

  /**
   * Get the context for a given class or name.
   * @param {string|Function} clazzOrName The class or name to look up
   * @returns {InstanceContext}
   * @throws {Error} If the context is not found
   */
  getContext(clazzOrName) {
    if (this.#instances.has(clazzOrName)) {
      return this.#instances.get(clazzOrName)
    }
    const available = Array.from(this.#instances.keys())
      .map(k => typeof k === 'string' ? k : k.name)
      .join(', ')
    throw new Error(
      `Cannot find injection source for "${clazzOrName?.name || clazzOrName}". ` +
      `Available: [${available}]`
    )
  }

  /**
   * Check if a class or name is registered.
   * @param {string|Function} clazzOrName The class or name to check
   * @returns {boolean}
   */
  has(clazzOrName) {
    return this.#instances.has(clazzOrName)
  }

  /**
   * Get or create an instance based on the context.
   * @param {InstanceContext} instanceContext The instance context
   * @param {Array} params Constructor parameters
   * @returns {Object} The instance
   */
  getInstance(instanceContext, params) {
    if (instanceContext.type === 'singleton' && !instanceContext.originalClazz && instanceContext.instance) {
      this.#log(`Returning cached singleton: ${instanceContext.clazz.name}`)
      return instanceContext.instance
    }

    let instance
    try {
      this.#log(`Creating ${instanceContext.type}: ${instanceContext.clazz.name}`)
      instance = new instanceContext.clazz(...params)
    } catch (err) {
      if (err instanceof RangeError) {
        throw new Error(
          `Circular dependency detected for ${instanceContext.clazz.name || instanceContext.clazz}. ` +
          `Use @InjectLazy to break the cycle.`
        )
      }
      throw err
    }

    if (instanceContext.proxy && instanceContext.originalClazz) {
      const originalInstance = new instanceContext.originalClazz(...params)
      instance = createProxy(instance, originalInstance)
    }

    if (instanceContext.type === 'singleton') {
      instanceContext.instance = instance
    }

    return instance
  }

  /**
   * Register a mock for an existing class.
   * @param {string|Function} targetClazzOrName The class or name to mock
   * @param {Function} mockClazz The mock class
   * @param {boolean} [useProxy=false] Whether to proxy unmocked methods to original
   */
  registerMock(targetClazzOrName, mockClazz, useProxy = false) {
    const instanceContext = this.getContext(targetClazzOrName)
    if (instanceContext.originalClazz) {
      throw new Error('Mock already defined, reset before mocking again')
    }
    instanceContext.originalClazz = instanceContext.clazz
    instanceContext.proxy = useProxy
    instanceContext.clazz = mockClazz
    const targetName = typeof targetClazzOrName === 'string' ? targetClazzOrName : targetClazzOrName.name
    this.#log(`Mocked ${targetName} with ${mockClazz.name}${useProxy ? ' (proxy)' : ''}`)
  }

  /**
   * Reset a specific mock to its original class.
   * @param {string|Function} clazzOrName The class or name to reset
   * @throws {Error} If the class or name is not registered
   */
  resetMock(clazzOrName) {
    this.#restoreOriginal(this.#instances.get(clazzOrName), clazzOrName)
  }

  /**
   * Reset all mocks to their original classes.
   */
  resetAllMocks() {
    for (const instanceContext of this.#instances.values()) {
      this.#restoreOriginal(instanceContext)
    }
  }

  /**
   * Clear all registered instances and mocks.
   * Useful for test isolation.
   */
  clear() {
    this.#instances.clear()
  }

  /**
   * Internal function to restore an instance context to its original.
   * @param {InstanceContext} instanceContext The instance context to reset
   * @param {string|Function} [clazzOrName] Optional identifier for error messages
   * @throws {Error} If instanceContext is null or undefined
   * @private
   */
  #restoreOriginal(instanceContext, clazzOrName) {
    if (!instanceContext) {
      const name = clazzOrName?.name || clazzOrName || 'unknown'
      throw new Error(`Cannot reset mock for "${name}": not registered`)
    }
    if (instanceContext.originalClazz) {
      instanceContext.clazz = instanceContext.originalClazz
      delete instanceContext.instance
      delete instanceContext.originalClazz
      delete instanceContext.originalInstance
      delete instanceContext.proxy
    }
  }
}
