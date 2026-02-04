import {Container} from './src/Container.js'

/** @type {Container} */
const defaultContainer = new Container()

/** @type {Map<string, Container>} - String-keyed containers */
const namedContainers = new Map()

/** @type {WeakMap<object, Container>} - Object-keyed containers (auto-cleanup on GC) */
const objectContainers = new WeakMap()

/** @private Get the appropriate map for a key type */
const getMapForKey = (key) => typeof key === 'object' ? objectContainers : namedContainers

/**
 * Get a container by key. Returns the default container if no key is provided.
 * - String keys: Creates named containers stored in a Map
 * - Object keys: Creates containers stored in a WeakMap (auto-cleanup when object is GC'd)
 * - Container instance: Returns it directly (convenience for when user passes container by mistake)
 * 
 * Child containers automatically inherit registrations from the default container.
 * 
 * @param {string|object} [key] - Optional container key (string name or object reference)
 * @returns {Container}
 */
export function getContainer(key) {
  if (key == null) {
    return defaultContainer
  }
  
  // If someone passes a Container directly, just return it
  // This handles the case where user mistakenly passes req.di instead of req
  if (key instanceof Container) {
    return key
  }
  
  const map = getMapForKey(key)
  if (!map.has(key)) {
    map.set(key, new Container(defaultContainer))
  }
  
  return map.get(key)
}

/**
 * Check if a container exists for the given key.
 * Returns true for null/undefined (default container always exists).
 * @param {string|object|null} [key] - Container key
 * @returns {boolean}
 */
export function hasContainer(key) {
  if (key == null) return true // default container always exists
  return getMapForKey(key).has(key)
}

/**
 * Destroy a container and remove it from the registry.
 * Cannot destroy the default container (returns false for null/undefined).
 * Note: Object-keyed containers are automatically cleaned up when the key object is GC'd.
 * @param {string|object|null} [key] - Container key
 * @returns {boolean} true if the container existed and was destroyed
 */
export function destroyContainer(key) {
  if (key == null) return false // cannot destroy default container
  
  const map = getMapForKey(key)
  const container = map.get(key)
  
  if (container) {
    container.clear()
    map.delete(key)
    return true
  }
  return false
}

/**
 * List all named (string-keyed) container names.
 * Note: Object-keyed containers cannot be enumerated (WeakMap limitation).
 * @returns {string[]}
 */
export function listContainers() {
  return [...namedContainers.keys()]
}

/**
 * Extract scope option from arguments array (for variadic functions).
 * Detects options object by checking for plain object with 'scope' key.
 * @private
 * @param {Array} args
 * @returns {{options: {scope?: string|object}, rest: Array}}
 */
function extractScopeOption(args) {
  const lastArg = args[args.length - 1]
  // Must be a plain object (not a class/function) with 'scope' property
  if (lastArg && typeof lastArg === 'object' && 
      lastArg.constructor === Object && 'scope' in lastArg) {
    return { options: lastArg, rest: args.slice(0, -1) }
  }
  return { options: {}, rest: args }
}

/**
 * Validate class decorator target.
 * @private
 */
function validateClassDecorator(clazz, context) {
  if (context.kind !== 'class') {
    throw new Error('Invalid injection target')
  }
  if (typeof clazz !== 'function' || !clazz.prototype) {
    throw new Error('Target must be a class constructor')
  }
}

/** @private */
function createLazyAccessor(cache, getValue, name) {
  return {
    init(initialValue) {
      if (initialValue !== undefined) {
        throw new Error(`Cannot assign value to injected accessor "${name}"`)
      }
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

/** @param {string} [name] */
export function Singleton(name) {
  return (clazz, context) => {
    validateClassDecorator(clazz, context)
    defaultContainer.registerSingleton(clazz, name)
  }
}

/** @param {string} [name] */
export function Factory(name) {
  return (clazz, context) => {
    validateClassDecorator(clazz, context)
    defaultContainer.registerFactory(clazz, name)
  }
}

/**
 * @param {string|Function} clazzOrName
 * @param {...*} params
 */
export function Inject(clazzOrName, ...params) {
  return (_, context) => {
    const getValue = () => {
      const instanceContext = defaultContainer.getContext(clazzOrName)
      return defaultContainer.getInstance(instanceContext, params)
    }

    if (context.kind === 'field') {
      return (initialValue) => {
        if (initialValue !== undefined) {
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
 * Defers instantiation until first access. For private fields, use accessor syntax for true lazy behavior.
 * @param {string|Function} clazzOrName
 * @param {...*} params
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
          if (initialValue !== undefined) {
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
 * @param {string|Function} mockedClazzOrName
 * @param {boolean} [proxy=false] If true, unmocked methods delegate to the original
 */
export function Mock(mockedClazzOrName, proxy = false) {
  return (clazz, context) => {
    if (context.kind !== 'class') {
      throw new Error('Invalid injection target')
    }
    defaultContainer.registerMock(mockedClazzOrName, clazz, proxy)
  }
}

/** Remove all mocks and restore originals. Does NOT clear mock call history. 
 * @param {{scope?: string}} [options]
 */
export function removeAllMocks(options = {}) {
  const container = getContainer(options.scope)
  container.removeAllMocks()
}

/** 
 * @param {string|Function} clazzOrName 
 * @param {{scope?: string}} [options]
 */
export function removeMock(clazzOrName, options = {}) {
  const container = getContainer(options.scope)
  container.removeMock(clazzOrName)
}

/** 
 * @param {{preserveMocks?: boolean, scope?: string}} [options] 
 */
export function resetSingletons(options = {}) {
  const { scope, ...resetOptions } = options
  const container = getContainer(scope)
  container.resetSingletons(resetOptions)
}

/** 
 * Clear a container. When scope is provided, clears that named container.
 * Note: To completely remove a named container, use destroyContainer() instead.
 * @param {{preserveRegistrations?: boolean, scope?: string}} [options] 
 */
export function clearContainer(options = {}) {
  const { scope, ...clearOptions } = options
  const container = getContainer(scope)
  container.clear(clearOptions)
}

/** 
 * @param {boolean} enabled 
 * @param {{scope?: string}} [options]
 */
export function setDebug(enabled, options = {}) {
  const container = getContainer(options.scope)
  container.setDebug(enabled)
}

/**
 * @param {string|Function} clazzOrName
 * @param {{scope?: string}} [options]
 * @returns {boolean}
 */
export function isRegistered(clazzOrName, options = {}) {
  const container = getContainer(options.scope)
  return container.has(clazzOrName)
}

/** 
 * @param {...(string|Function)} tokens 
 * @param {{scope?: string}} [options] - Optional last argument
 */
export function validateRegistrations(...args) {
  const { options, rest: tokens } = extractScopeOption(args)
  const container = getContainer(options.scope)
  const missing = tokens.filter(token => !container.has(token))
  if (missing.length === 0) return
  
  const names = missing.map(t => t?.name ?? t).join(', ')
  const scopeHint = options.scope ? ` in scope "${options.scope}"` : ''
  throw new Error(
    `Missing registrations${scopeHint}: [${names}]. ` +
    `Ensure these classes are decorated with @Singleton() or @Factory() before use.`
  )
}

/**
 * @template T
 * @param {string|Function} clazzOrName
 * @param {...*} paramsOrOptions - Constructor params, or options object as last argument
 * @returns {T}
 */
export function resolve(clazzOrName, ...paramsOrOptions) {
  const { options, rest: params } = extractScopeOption(paramsOrOptions)
  const container = getContainer(options.scope)
  return container.resolve(clazzOrName, ...params)
}

/**
 * @template T
 * @param {string|Function} clazzOrName
 * @param {...*} paramsOrOptions - Constructor params, or options object as last argument
 * @returns {T}
 */
export function getMockInstance(clazzOrName, ...paramsOrOptions) {
  const { options, rest: params } = extractScopeOption(paramsOrOptions)
  const container = getContainer(options.scope)
  return container.getMockInstance(clazzOrName, ...params)
}

/**
 * @param {string|Function} clazzOrName
 * @param {{scope?: string}} [options]
 * @returns {boolean}
 */
export function isMocked(clazzOrName, options = {}) {
  const container = getContainer(options.scope)
  return container.isMocked(clazzOrName)
}

/**
 * @param {string|Function} clazzOrName
 * @param {{scope?: string}} [options]
 * @returns {boolean}
 */
export function unregister(clazzOrName, options = {}) {
  const container = getContainer(options.scope)
  return container.unregister(clazzOrName)
}

/** 
 * @param {{scope?: string}} [options]
 * @returns {Array<{key: string|Function, name: string, type: 'singleton'|'factory', isMocked: boolean, hasInstance: boolean}>} 
 */
export function listRegistrations(options = {}) {
  const container = getContainer(options.scope)
  return container.list()
}

export {Container}
export {defaultContainer}
export {createProxy} from './src/proxy.js'
