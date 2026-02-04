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

  /** @type {Container|null} */
  #parent = null

  #debug = false

  /**
   * @param {Container} [parent] - Optional parent container for auto-registration fallback
   */
  constructor(parent = null) {
    this.#parent = parent
  }

  get [Symbol.toStringTag]() {
    return 'Container'
  }

  /** @yields {RegistrationInfo} */
  *[Symbol.iterator]() {
    yield* this.list()
  }

  /** @returns {number} */
  get size() {
    return this.#instances.size
  }

  /** @returns {Container|null} */
  get parent() {
    return this.#parent
  }

  /** @param {boolean} enabled */
  setDebug(enabled) {
    this.#debug = enabled
  }

  #log(message) {
    if (this.#debug) {
      console.log(`[DI] ${message}`)
    }
  }

  /**
   * @param {Function} clazz
   * @param {string} [name]
   */
  registerSingleton(clazz, name) {
    this.#register(clazz, 'singleton', name)
  }

  /**
   * @param {Function} clazz
   * @param {string} [name]
   */
  registerFactory(clazz, name) {
    this.#register(clazz, 'factory', name)
  }

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
   * Auto-register from parent container if available.
   * @param {string|Function} clazzOrName
   * @returns {boolean} true if auto-registered
   */
  #autoRegisterFromParent(clazzOrName) {
    if (!this.#parent || this.#instances.has(clazzOrName) || !this.#parent.has(clazzOrName)) {
      return false
    }
    
    const parentContext = this.#parent.getContext(clazzOrName)
    const name = typeof clazzOrName === 'string' ? clazzOrName : undefined
    this.#register(parentContext.clazz, parentContext.type, name)
    this.#log(`Auto-registered from parent: ${name || parentContext.clazz.name}`)
    return true
  }

  /**
   * @param {string|Function} clazzOrName
   * @returns {InstanceContext}
   * @throws {Error} If not found (and not in parent)
   */
  getContext(clazzOrName) {
    // Try auto-register from parent first
    this.#autoRegisterFromParent(clazzOrName)
    
    const context = this.#instances.get(clazzOrName)
    if (context) {
      return context
    }
    
    const name = clazzOrName?.name ?? clazzOrName
    const nameStr = String(name)
    const available = [...this.#instances.keys()]
      .map(k => typeof k === 'string' ? k : k.name)
      .join(', ')
    
    // Detect common mock class naming patterns from module mocking systems
    const looksLikeMock = /^Mock[A-Z]/.test(nameStr) ||
                          /Mock$/.test(nameStr) ||
                          /^(vi|jest|sinon)_/.test(nameStr)
    
    const hint = looksLikeMock
      ? `\n\nThis looks like a mock from a module mocking system (vi.mock/jest.mock). ` +
        `Use @Mock(OriginalClass) instead to properly register with the DI container.`
      : ''
    
    throw new Error(
      `Cannot find injection source for "${name}". Available: [${available}]${hint}`
    )
  }

  /** 
   * @param {string|Function} clazzOrName 
   * @param {boolean} [checkParent=true] - Also check parent container (default: true for consistency with resolve)
   */
  has(clazzOrName, checkParent = true) {
    if (this.#instances.has(clazzOrName)) {
      return true
    }
    if (checkParent && this.#parent) {
      return this.#parent.has(clazzOrName, true)
    }
    return false
  }

  /** @param {string|Function} clazzOrName */
  isMocked(clazzOrName) {
    return !!this.#instances.get(clazzOrName)?.originalClazz
  }

  /**
   * @param {string|Function} clazzOrName
   * @returns {boolean} true if removed
   */
  unregister(clazzOrName) {
    const removed = this.#instances.delete(clazzOrName)
    if (removed) {
      this.#log(`Unregistered: ${clazzOrName?.name ?? clazzOrName}`)
    }
    return removed
  }

  /** @returns {Array<{key: string|Function, name: string, type: 'singleton'|'factory', isMocked: boolean, hasInstance: boolean}>} */
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
   * @template T
   * @param {string|Function} clazzOrName
   * @param {...*} params
   * @returns {T}
   */
  resolve(clazzOrName, ...params) {
    const instanceContext = this.getContext(clazzOrName)
    return this.getInstance(instanceContext, params)
  }

  /**
   * @param {InstanceContext} instanceContext
   * @param {Array} params
   * @returns {Object}
   */
  getInstance(instanceContext, params) {
    if (instanceContext.type === 'singleton' && instanceContext.instance) {
      this.#log(`Returning cached singleton: ${instanceContext.clazz.name}`)
      return instanceContext.instance
    }

    this.#log(`Creating ${instanceContext.type}: ${instanceContext.clazz.name}`)
    let instance
    try {
      instance = new instanceContext.clazz(...params)
    } catch (err) {
      if (err instanceof RangeError) {
        throw new Error(
          `Circular dependency detected for ${instanceContext.clazz.name ?? instanceContext.clazz}. ` +
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
   * @param {string|Function} targetClazzOrName
   * @param {Function} mockClazz
   * @param {boolean} [useProxy=false]
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
      instance: undefined
    })
    this.#log(`Mocked ${targetClazzOrName?.name ?? targetClazzOrName} with ${mockClazz.name}${useProxy ? ' (proxy)' : ''}`)
  }

  /**
   * Remove mock and restore original. Does NOT clear mock call history.
   * @param {string|Function} clazzOrName
   */
  removeMock(clazzOrName) {
    this.#restoreOriginal(this.#instances.get(clazzOrName), clazzOrName)
  }

  /** Remove all mocks. Does NOT clear mock call history. */
  removeAllMocks() {
    for (const instanceContext of this.#instances.values()) {
      this.#restoreOriginal(instanceContext)
    }
  }

  /**
   * Clear cached singleton instances. They'll be recreated on next resolve.
   * @param {Object} [options]
   * @param {boolean} [options.preserveMocks=true]
   */
  resetSingletons(options = {}) {
    const { preserveMocks = true } = options
    
    for (const instanceContext of this.#instances.values()) {
      delete instanceContext.instance
      if (!preserveMocks && instanceContext.originalClazz) {
        this.#restoreOriginal(instanceContext)
      }
    }
    this.#log(`Reset singletons (preserveMocks: ${preserveMocks})`)
  }

  /**
   * Clear all registrations. Use resetSingletons() to keep registrations.
   * @param {Object} [options]
   * @param {boolean} [options.preserveRegistrations=false]
   */
  clear(options = {}) {
    const { preserveRegistrations = false } = options
    
    if (preserveRegistrations) {
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
   * @template T
   * @param {string|Function} clazzOrName
   * @param {...*} params
   * @returns {T}
   * @throws {Error} If not mocked
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
        proxy: undefined
      })
    }
  }
}
