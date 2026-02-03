/**
 * @typedef {Object} InstanceContext
 * @property {'singleton'|'factory'} type - The type of the instance.
 * @property {Function} clazz - The class constructor for the instance.
 * @property {Function} [originalClazz] - The original class if this is a mock.
 * @property {Object} [instance] - The singleton instance, if created.
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
   * Custom string tag for better debugging.
   * Shows as [object Container] in console.
   */
  get [Symbol.toStringTag]() {
    return 'Container'
  }

  /**
   * Make the container iterable.
   * Yields registration info for each registered class.
   * @yields {RegistrationInfo}
   */
  *[Symbol.iterator]() {
    yield* this.list()
  }

  /**
   * Get the number of registrations in the container.
   * @returns {number}
   */
  get size() {
    return this.#instances.size
  }

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
    const context = this.#instances.get(clazzOrName)
    if (context) {
      return context
    }
    const available = [...this.#instances.keys()]
      .map(k => typeof k === 'string' ? k : k.name)
      .join(', ')
    
    const name = clazzOrName?.name || clazzOrName
    const nameStr = String(name)
    
    // Detect if this looks like a mock class from a module mocking system
    const looksLikeMock = /^Mock[A-Z]|mock/i.test(nameStr) || 
                          nameStr.includes('Mock') ||
                          nameStr.startsWith('vi_') ||
                          nameStr.startsWith('jest_')
    
    let errorMessage = `Cannot find injection source for "${name}". ` +
      `Available: [${available}]`
    
    if (looksLikeMock) {
      errorMessage += `\n\nHint: The class name "${name}" suggests this may be a mock created by a module mocking system. ` +
        `If you're using module mocking (e.g., vi.mock() or jest.mock()), consider using @Mock(OriginalService) instead, ` +
        `which properly registers with the DI container.`
    }
    
    throw new Error(errorMessage)
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
   * Check if a class or name has a mock registered.
   * @param {string|Function} clazzOrName The class or name to check
   * @returns {boolean} true if a mock is registered, false otherwise
   */
  isMocked(clazzOrName) {
    return !!this.#instances.get(clazzOrName)?.originalClazz
  }

  /**
   * Unregister a class or name from the container.
   * This removes the registration entirely, including any mock.
   * 
   * @param {string|Function} clazzOrName The class or name to unregister
   * @returns {boolean} true if the registration was removed, false if it wasn't registered
   * 
   * @example
   * container.unregister(MyService) // Returns true if was registered
   */
  unregister(clazzOrName) {
    const removed = this.#instances.delete(clazzOrName)
    if (removed) {
      this.#log(`Unregistered: ${clazzOrName?.name ?? clazzOrName}`)
    }
    return removed
  }

  /**
   * List all registrations in the container.
   * Useful for debugging and introspection.
   * 
   * @returns {Array<{key: string|Function, type: 'singleton'|'factory', isMocked: boolean, hasInstance: boolean}>}
   * 
   * @example
   * container.list().forEach(reg => {
   *   console.log(`${reg.key}: ${reg.type}, mocked: ${reg.isMocked}`)
   * })
   */
  list() {
    return [...this.#instances.entries()].map(([key, context]) => ({
      key,
      name: typeof key === 'string' ? key : key.name,
      type: context.type,
      isMocked: !!context.originalClazz,
      hasInstance: !!context.instance
    }))
  }

  /**
   * Resolve and return an instance by class or name.
   * This allows non-decorator code to retrieve instances from the container.
   * @template T
   * @param {string|Function} clazzOrName The class or name to resolve
   * @param {...*} params Parameters to pass to the constructor
   * @returns {T} The resolved instance
   * @throws {Error} If the class or name is not registered
   */
  resolve(clazzOrName, ...params) {
    const instanceContext = this.getContext(clazzOrName)
    return this.getInstance(instanceContext, params)
  }

  /**
   * Get or create an instance based on the context.
   * @param {InstanceContext} instanceContext The instance context
   * @param {Array} params Constructor parameters
   * @returns {Object} The instance
   */
  getInstance(instanceContext, params) {
    if (instanceContext.type === 'singleton' && instanceContext.instance) {
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
    Object.assign(instanceContext, {
      originalClazz: instanceContext.clazz,
      clazz: mockClazz,
      proxy: useProxy,
      instance: undefined // Clear cached instance so the mock takes effect on next resolve
    })
    this.#log(`Mocked ${targetClazzOrName?.name ?? targetClazzOrName} with ${mockClazz.name}${useProxy ? ' (proxy)' : ''}`)
  }

  /**
   * Remove a specific mock and restore the original class.
   * This completely removes the mock - it does NOT just clear mock call history.
   * 
   * @param {string|Function} clazzOrName The class or name to restore
   * @throws {Error} If the class or name is not registered
   * 
   * @example
   * // After this call, resolve(MyService) returns the original class, not the mock
   * container.removeMock(MyService)
   */
  removeMock(clazzOrName) {
    this.#restoreOriginal(this.#instances.get(clazzOrName), clazzOrName)
  }

  /**
   * @deprecated Use removeMock() instead. This method will be removed in a future version.
   * 
   * Note: This does NOT reset mock call history like vi.fn().mockClear().
   * It completely removes the mock and restores the original class.
   * 
   * @param {string|Function} clazzOrName The class or name to restore
   * @throws {Error} If the class or name is not registered
   */
  resetMock(clazzOrName) {
    console.warn(
      '[DI] resetMock() is deprecated and will be removed in a future version. ' +
      'Use removeMock() instead. Note: This removes the mock entirely, ' +
      'it does NOT clear mock call history.'
    )
    this.removeMock(clazzOrName)
  }

  /**
   * Remove all mocks and restore original classes.
   * This completely removes all mocks - it does NOT just clear mock call history.
   */
  removeAllMocks() {
    for (const instanceContext of this.#instances.values()) {
      this.#restoreOriginal(instanceContext)
    }
  }

  /**
   * @deprecated Use removeAllMocks() instead. This method will be removed in a future version.
   * 
   * Note: This does NOT reset mock call history.
   * It completely removes all mocks and restores original classes.
   */
  resetAllMocks() {
    console.warn(
      '[DI] resetAllMocks() is deprecated and will be removed in a future version. ' +
      'Use removeAllMocks() instead. Note: This removes all mocks entirely, ' +
      'it does NOT clear mock call history.'
    )
    this.removeAllMocks()
  }

  /**
   * Reset singleton instances without removing registrations.
   * This clears cached singleton instances so they will be recreated on next resolve.
   * Mock registrations are preserved by default.
   * 
   * @param {Object} [options] Options for resetting
   * @param {boolean} [options.preserveMocks=true] If true, keeps mock registrations intact.
   *                                                If false, also removes mocks (same as clear()).
   * 
   * @example
   * // Clear singleton instances but keep mocks registered
   * container.resetSingletons()
   * 
   * // Clear singleton instances AND remove mocks
   * container.resetSingletons({ preserveMocks: false })
   */
  resetSingletons(options = {}) {
    const { preserveMocks = true } = options
    
    for (const instanceContext of this.#instances.values()) {
      // Clear the cached singleton instance
      delete instanceContext.instance
      
      // Optionally remove mock registrations
      if (!preserveMocks && instanceContext.originalClazz) {
        this.#restoreOriginal(instanceContext)
      }
    }
    this.#log(`Reset singletons (preserveMocks: ${preserveMocks})`)
  }

  /**
   * Clear all registered instances and mocks.
   * Useful for complete test isolation between test suites.
   * 
   * Note: By default this removes ALL registrations including @Singleton and @Factory classes.
   * For clearing just singleton instances while keeping registrations, use resetSingletons().
   * 
   * @param {Object} [options] Options for clearing
   * @param {boolean} [options.preserveRegistrations=false] If true, keeps all registrations but clears cached instances.
   * 
   * @example
   * // Remove everything (full reset)
   * container.clear()
   * 
   * // Clear cached instances but keep all registrations (including mocks)
   * container.clear({ preserveRegistrations: true })
   */
  clear(options = {}) {
    const { preserveRegistrations = false } = options
    
    if (preserveRegistrations) {
      // Just clear cached instances, keep all registrations
      for (const instanceContext of this.#instances.values()) {
        delete instanceContext.instance
      }
      this.#log('Cleared instances (preserved registrations)')
    } else {
      this.#instances.clear()
      this.#log('Cleared all registrations')
    }
  }

  /**
   * Get the mock instance for a mocked class.
   * This is useful when you need to configure mock behavior dynamically in tests.
   * 
   * @template T
   * @param {string|Function} clazzOrName The original class or name that was mocked
   * @param {...*} params Parameters to pass to the constructor
   * @returns {T} The mock instance
   * @throws {Error} If the class is not registered
   * @throws {Error} If the class is not mocked
   * 
   * @example
   * @Mock(UserService)
   * class MockUserService {
   *   getUser = vi.fn()
   * }
   * 
   * // In test:
   * const mockInstance = container.getMockInstance(UserService)
   * mockInstance.getUser.mockReturnValue({ id: 1, name: 'Test' })
   */
  getMockInstance(clazzOrName, ...params) {
    const instanceContext = this.getContext(clazzOrName)
    
    if (!instanceContext.originalClazz) {
      const name = clazzOrName?.name ?? clazzOrName
      throw new Error(
        `"${name}" is not mocked. Use @Mock(${name}) to register a mock first.`
      )
    }
    
    return this.getInstance(instanceContext, params)
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
      Object.assign(instanceContext, {
        clazz: instanceContext.originalClazz,
        instance: undefined,
        originalClazz: undefined,
        originalInstance: undefined,
        proxy: undefined
      })
    }
  }
}
