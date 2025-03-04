/**
 * @typedef {Object} InstanceContext
 * @property {string} type The type of the instance, either 'singleton' or 'factory'
 * @property {Class} clazz The class of the instance
 * @property {Class} [originalClazz] The original class if it is a mock
 * @property {Object} [instance] The instance if it is a singleton
 * @property {Object} [originalInstance] The original instance if it is a mock
 * @property {boolean} [proxy=false] If true, the mock if the injection instance will be a proxy to the original class
 */

/** @type {Map<string|Class, InstanceContext>} */
const instances = new Map()

/**
 * Register a class as a singleton. If a name is provided, it will be used as the key in the singleton map.
 * Singleton instances only ever have one instance created via the @Inject decorator.
 *
 * @param {string} [name] The name of the singleton. If not provided, the class will be used as the key.
 * @return {(function(*, *): void)|*}
 * @example @Singleton() class MySingleton {}
 * @example @Singleton('customName') class MySingleton {}
 * @throws {Error} If the injection target is not a class
 * @throws {Error} If a singleton with the same name is already defined
 * @throws {Error} If a factory with the same name is already defined
 */
export function Singleton(name) {
  return function (clazz, context) {
    if (context.kind !== "class") {
      throw new Error('Invalid injection target')
    }
    if (instances.has(name ?? clazz)) {
      throw new Error('Instance with that name or class already instantiated')
    }
    instances.set(name ?? clazz, { clazz, type: 'singleton' })
  }
}

/**
 * Register a class as a factory. If a name is provided, it will be used as the key in the factory map.
 * Factory instances are created via the @Inject decorator. Each call to the factory will create a new instance.
 *
 * @param {string} [name] The name of the factory. If not provided, the class will be used as the key.
 * @return {(function(*, *): void)|*}
 * @example @Factory() class MyFactory {}
 * @example @Factory('customName') class MyFactory {}
 * @throws {Error} If the injection target is not a class
 * @throws {Error} If a factory with the same name is already defined
 * @throws {Error} If a singleton with the same name is already defined
 */
export function Factory(name) {
  return function (clazz, context) {
    if (context.kind !== "class") {
      throw new Error('Invalid injection target')
    }
    if (instances.has(name ?? clazz)) {
      throw new Error('Instance with that name or class already instantiated')
    }
    instances.set(name ?? clazz, { clazz, type: 'factory' })
  }
}

/**
 * Inject a singleton or factory instance into a class field. You can also provide parameters to the constructor.
 * If the instance is a singleton, it will only be created once with the first set of parameters it encounters.
 *
 * @param {string|Class} clazzOrName The singleton or factory class or name
 * @param {*} params Parameters to pass to the constructor. Recommended to use only with factories.
 * @return {(function(*): void)|*}
 * @example @Inject(MySingleton) mySingleton
 * @example @Inject("myCustomName") myFactory
 * @throws {Error} If the injection target is not a field
 * @throws {Error} If the injected field is assigned a value
 */
export function Inject(clazzOrName, ...params) {
  return function(initialValue, context) {
    if (context.kind === "field") {
      return function(initialValue) {
        if (initialValue) {
          throw new Error('Cannot assign value to injected field')
        }
        const instanceContext = getContext(clazzOrName)

        if (instanceContext.instance) {
          return instanceContext.instance
        }

        const instance = new instanceContext.clazz(...params)

        if (instanceContext.type === 'singleton') {
          if (instanceContext.originalClazz && instanceContext.proxy) {
            instanceContext.instance = getProxy(instance, new instanceContext.originalClazz(...params))
          } else {
            instanceContext.instance = instance
          }
          return instanceContext.instance
        }

        if (instanceContext.type === 'factory') {
          if (instanceContext.originalClazz && instanceContext.proxy) {
            return getProxy(instance, new instanceContext.originalClazz(...params))
          } else {
            return instance
          }
        }

        throw new Error('Unexpected injection type')
      }
    } else {
      throw new Error('Invalid injection target')
    }
  }
}

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
 * @return {(function(*, *): void)|*}
 * @example @Mock(MySingleton) class MyMock {}
 * @example @Mock("myCustomName") class MyMock {}
 * @throws {Error} If the injection target is not a class
 * @throws {Error} If the injection source is not found
 */
export function Mock(mockedClazzOrName, proxy = false) {
  return function(clazz, context) {
    if (context.kind !== "class") {
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

function getContext(mockedClazzOrName) {
  if (instances.has(mockedClazzOrName)) {
    return instances.get(mockedClazzOrName)
  } else {
    throw new Error('Cannot find injection source with the provided name')
  }
}

/**
 * Reset all mocks to their original classes.
 */
export function resetMocks() {
  for (const instanceContext of instances.values()) {
    reset(instanceContext)
  }
}

/**
 * Reset a specific mock to its original class.
 * @param {string|Class} clazzOrName The singleton or factory class or name to reset
 */
export function resetMock(clazzOrName) {
  reset(getContext(clazzOrName))
}

/**
 * Internal function to reset an instance context to its original.
 * @param {InstanceContext} instanceContext The instance context to reset
 * @private
 */
function reset(instanceContext) {
  if (!instanceContext) {
    throw new Error('Cannot find injection source with the provided name')
  }
  if (instanceContext.originalClazz) {
    instanceContext.clazz = instanceContext.originalClazz
    instanceContext.instance = instanceContext.originalInstance
    delete instanceContext.originalClazz
    delete instanceContext.originalInstance
  }
}
