/**
 * @typedef {Object} InstanceContext
 * @property {'singleton'|'factory'} type - The type of the instance.
 * @property {Function} clazz - The class constructor for the instance.
 * @property {Function} [originalClazz] - The original class if this is a mock.
 * @property {Object} [instance] - The singleton instance, if created.
 * @property {Object} [originalInstance] - The original instance if this is a mock.
 * @property {boolean} [proxy=false] - If true, the mock will proxy to the original class for undefined methods/properties.
 */

/** @type {Map<string|Class, InstanceContext>} */
const instances = new Map()

/**
 * Register a class as a singleton. If a name is provided, it will be used as the key in the singleton map.
 * Singleton instances only ever have one instance created via the @Inject decorator.
 *
 * @param {string} [name] The name of the singleton. If not provided, the class will be used as the key.
 * @return {(function(Function, {kind: string}): void)}
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
    const key = name ?? clazz
    if (instances.has(key)) {
      throw new Error('A different class is already registered under this name. This may be possibly a circular dependency. Try using @InjectLazy')
    }
    instances.set(key, {clazz, type: 'singleton'})
  }
}

/**
 * Register a class as a factory. If a name is provided, it will be used as the key in the factory map.
 * Factory instances are created via the @Inject decorator. Each call to the factory will create a new instance.
 *
 * @param {string} [name] The name of the factory. If not provided, the class will be used as the key.
 * @return {(function(Function, {kind: string}): void)}
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
    const key = name ?? clazz
    if (instances.has(key)) {
      throw new Error('A different class is already registered under this name, This may be possibly a circular dependency. Try using @InjectLazy')
    }
    instances.set(key, {clazz, type: 'factory'})
  }
}

/**
 * Inject a singleton or factory instance into a class field. You can also provide parameters to the constructor.
 * If the instance is a singleton, it will only be created once with the first set of parameters it encounters.
 *
 * @param {string|Class} clazzOrName The singleton or factory class or name
 * @param {*} params Parameters to pass to the constructor. Recommended to use only with factories.
 * @return {(function(*, {kind: string, name: string}): void)}
 * @example @Inject(MySingleton) mySingleton
 * @example @Inject("myCustomName") myFactory
 * @throws {Error} If the injection target is not a field
 * @throws {Error} If the injected field is assigned a value
 */
export function Inject(clazzOrName, ...params) {
  return function (initialValue, context) {
    if (context.kind !== 'field') {
      throw new Error('Invalid injection target')
    }
    return function (initialValue) {
      if (initialValue) {
        throw new Error('Cannot assign value to injected field')
      }
      const instanceContext = getContext(clazzOrName)
      return getInjectedInstance(instanceContext, params)
    }
  }
}

/**
 * Inject a singleton or factory instance lazily into a class field. You can also provide parameters to the constructor.
 * If the instance is a singleton, it will only be created once with the first set of parameters it encounters.
 * @param {string|Class} clazzOrName The singleton or factory class or name
 * @param {*} params Parameters to pass to the constructor. Recommended to use only with factories.
 * @return {(function(*, {kind: string, name: string, addInitializer: Function}): void)}
 * @example @InjectLazy(MySingleton) mySingleton
 * @example @InjectLazy("myCustomName") myFactory
 * @throws {Error} If the injection target is not a field
 * @throws {Error} If the injected field is assigned a value
 */
export function InjectLazy(clazzOrName, ...params) {
  const cache = new WeakMap()
  return (initialValue, context) => {
    if (context.kind !== 'field') {
      throw new Error('Invalid injection target')
    }
    context.addInitializer(function () {
      Object.defineProperty(this, context.name, {
        get() {
          if (!cache.has(this)) {
            const instanceContext = getContext(clazzOrName)
            const value = getInjectedInstance(instanceContext, params)
            cache.set(this, value)
          }
          return cache.get(this)
        },
        configurable: true,
        enumerable: true
      })
    })
  }
}

/**
 * Get a proxy for the mock instance. This allows the mock to call methods on the original class if they are not defined in the mock.
 * @param {Object} mock The mock instance
 * @param {Object} original The original class instance
 * @return {*|object} The proxy instance
 */
function getProxy(mock, original) {
  return new Proxy(mock, {
    get(target, prop, receiver) {
      if (prop in target) {
        return Reflect.get(target, prop, receiver)
      }
      return Reflect.get(original, prop, receiver)
    }
  })
}

/**
 * Mark a class as a mock. This will replace the class with a mock instance when injected.
 * @param {string|Class} mockedClazzOrName The singleton or factory class or name to be mocked
 * @param {boolean} [proxy=false] If true, the mock will be a proxy to the original class. Any methods not defined in the mock will be called on the original class.
 * @return {(function(Function, {kind: string}): void)}
 * @example @Mock(MySingleton) class MyMock {}
 * @example @Mock("myCustomName") class MyMock {}
 * @throws {Error} If the injection target is not a class
 * @throws {Error} If the injection source is not found
 */
export function Mock(mockedClazzOrName, proxy = false) {
  return function (clazz, context) {
    if (context.kind !== 'class') {
      throw new Error('Invalid injection target')
    }
    const instanceContext = getContext(mockedClazzOrName)
    if (instanceContext.originalClazz) {
      throw new Error('Mock already defined, reset before mocking again')
    }
    instanceContext.originalClazz = instanceContext.clazz
    instanceContext.proxy = proxy
    instanceContext.clazz = clazz
  }
}

/**
 * Internal: Get the context for a given class or name.
 *
 * @param {string|Class} mockedClazzOrName - The class or name to look up.
 * @returns {InstanceContext}
 * @throws {Error} If the context is not found.
 */
function getContext(mockedClazzOrName) {
  if (instances.has(mockedClazzOrName)) {
    return instances.get(mockedClazzOrName)
  } else {
    const available = Array.from(instances.keys()).map(k => typeof k === 'string' ? k : k.name).join(', ')
    throw new Error(
      `Cannot find injection source for "${mockedClazzOrName?.name || mockedClazzOrName}". ` +
      `Available: [${available}]`
    )
  }
}

/**
 * Reset all mocks to their original classes.
 */
export function resetMocks() {
  for (const instanceContext of instances.values()) {
    restoreOriginal(instanceContext)
  }
}

/**
 * Reset a specific mock to its original class.
 * @param {string|Class} clazzOrName The singleton or factory class or name to reset
 */
export function resetMock(clazzOrName) {
  restoreOriginal(getContext(clazzOrName))
}

/**
 * Internal function to reset an instance context to its original.
 * @param {InstanceContext} instanceContext The instance context to reset
 * @private
 */
function restoreOriginal(instanceContext) {
  if (!instanceContext) {
    throw new Error('Cannot find injection source with the provided name')
  }
  if (instanceContext.originalClazz) {
    instanceContext.clazz = instanceContext.originalClazz
    delete instanceContext.instance
    delete instanceContext.originalClazz
    delete instanceContext.originalInstance
  }
}

/**
 * Get the injected instance based on the context and parameters.
 * @param {InstanceContext} instanceContext The instance context
 * @param {Array} params The parameters to pass to the constructor
 * @return {Object} The injected instance
 */
function getInjectedInstance(instanceContext, params) {
  if (instanceContext.type === 'singleton' && !instanceContext.originalClazz && instanceContext.instance) {
    return instanceContext.instance
  }
  let instance
  try {
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
    instance = getProxy(instance, originalInstance)
  }
  if (instanceContext.type === 'singleton') {
    instanceContext.instance = instance
  }
  return instance
}
