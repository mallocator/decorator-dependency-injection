import {Container} from './src/Container.js'

/** @type {Container} */
const defaultContainer = new Container()

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
    if (context.kind !== 'class') {
      throw new Error('Invalid injection target')
    }
    if (typeof clazz !== 'function' || !clazz.prototype) {
      throw new Error('Target must be a class constructor')
    }
    defaultContainer.registerSingleton(clazz, name)
  }
}

/** @param {string} [name] */
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

/** Remove all mocks and restore originals. Does NOT clear mock call history. */
export function removeAllMocks() {
  defaultContainer.removeAllMocks()
}

/** @param {string|Function} clazzOrName */
export function removeMock(clazzOrName) {
  defaultContainer.removeMock(clazzOrName)
}

/** @param {{preserveMocks?: boolean}} [options] */
export function resetSingletons(options) {
  defaultContainer.resetSingletons(options)
}

/** @param {{preserveRegistrations?: boolean}} [options] */
export function clearContainer(options) {
  defaultContainer.clear(options)
}

/** @returns {Container} */
export function getContainer() {
  return defaultContainer
}

/** @param {boolean} enabled */
export function setDebug(enabled) {
  defaultContainer.setDebug(enabled)
}

/**
 * @param {string|Function} clazzOrName
 * @returns {boolean}
 */
export function isRegistered(clazzOrName) {
  return defaultContainer.has(clazzOrName)
}

/** @param {...(string|Function)} tokens */
export function validateRegistrations(...tokens) {
  const missing = tokens.filter(token => !defaultContainer.has(token))
  if (missing.length === 0) return
  
  const names = missing.map(t => t?.name ?? t).join(', ')
  throw new Error(
    `Missing registrations: [${names}]. ` +
    `Ensure these classes are decorated with @Singleton() or @Factory() before use.`
  )
}

/**
 * @template T
 * @param {string|Function} clazzOrName
 * @param {...*} params
 * @returns {T}
 */
export function resolve(clazzOrName, ...params) {
  return defaultContainer.resolve(clazzOrName, ...params)
}

/**
 * @template T
 * @param {string|Function} clazzOrName
 * @param {...*} params
 * @returns {T}
 */
export function getMockInstance(clazzOrName, ...params) {
  return defaultContainer.getMockInstance(clazzOrName, ...params)
}

/**
 * @param {string|Function} clazzOrName
 * @returns {boolean}
 */
export function isMocked(clazzOrName) {
  return defaultContainer.isMocked(clazzOrName)
}

/**
 * @param {string|Function} clazzOrName
 * @returns {boolean}
 */
export function unregister(clazzOrName) {
  return defaultContainer.unregister(clazzOrName)
}

/** @returns {Array<{key: string|Function, name: string, type: 'singleton'|'factory', isMocked: boolean, hasInstance: boolean}>} */
export function listRegistrations() {
  return defaultContainer.list()
}

export {Container}
export {defaultContainer}
export {createProxy} from './src/proxy.js'
