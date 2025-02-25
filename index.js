/**
 * @typedef {Object} InstanceContext
 * @property {Class} clazz The class of the instance
 * @property {Object} [instance] The instance if it is a singleton
 * @property {Class} [original] The original class if it is a mock
 */

/** @type {Map<string|Class, InstanceContext>} */
const singletons = new Map()
/** @type {Map<string|Class, InstanceContext>} */
const factories = new Map()

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
    if (singletons.has(name ?? clazz)) {
      throw new Error('Singleton already defined')
    }
    if (factories.has(name ?? clazz)) {
      throw new Error('Factory with the same name already defined')
    }
    singletons.set(name ?? clazz, { clazz })
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
    if (factories.has(name ?? clazz)) {
      throw new Error('Factory already defined')
    }
    if (singletons.has(name ?? clazz)) {
      throw new Error('Singleton with the same name already defined')
    }
    factories.set(name ?? clazz, { clazz })
  }
}

/**
 * Inject a singleton or factory instance into a class field. You can also provide parameters to the constructor.
 * If the instance is a singleton, it will only be created once with the first set of parameters it encounters.
 *
 * @param {string|Class} clazzOrName The singleton or factory class or name
 * @param {*} params Parameters to pass to the constructor
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
        if (singletons.has(clazzOrName)) {
          const instanceContext = singletons.get(clazzOrName)
          if (!instanceContext.instance) {
            singletons.set(clazzOrName, {clazz: clazzOrName, instance: new instanceContext.clazz(...params), original: instanceContext.original})
          }
          return singletons.get(clazzOrName).instance
        } else if (factories.has(clazzOrName)) {
          const factoryClass = factories.get(clazzOrName).clazz
          return new factoryClass(...params)
        } else {
          throw new Error('Cannot find injection source with the provided name')
        }
      }
    } else {
      throw new Error('Invalid injection target')
    }
  }
}

/**
 * Mark a class as a mock. This will replace the class with a mock instance when injected.
 * @param {string|Class} mockedClazzOrName The singleton or factory class or name to be mocked
 * @return {(function(*, *): void)|*}
 * @example @Mock(MySingleton) class MyMock {}
 * @example @Mock("myCustomName") class MyMock {}
 * @throws {Error} If the injection target is not a class
 * @throws {Error} If the injection source is not found
 */
export function Mock(mockedClazzOrName) {
  return function(clazz, context) {
    if (context.kind !== "class") {
      throw new Error('Invalid injection target')
    }
    if (singletons.has(mockedClazzOrName)) {
      const instanceContext = singletons.get(mockedClazzOrName)
      if (instanceContext.original) {
        throw new Error('Mock already defined, reset before mocking again')
      }
      instanceContext.original = instanceContext.clazz
      instanceContext.clazz = clazz
    } else if (factories.has(mockedClazzOrName)) {
      const instanceContext = factories.get(mockedClazzOrName)
      if (instanceContext.original) {
        throw new Error('Mock already defined, reset before mocking again')
      }
      instanceContext.original = instanceContext.clazz
      instanceContext.clazz = clazz
    } else {
      throw new Error('Cannot find injection source with the provided name')
    }
  }
}

/**
 * Reset all mocks to their original classes.
 */
export function resetMocks() {
  for (const instanceContext of singletons.values()) {
    reset(instanceContext)
  }
  for (const instanceContext of factories.values()) {
    reset(instanceContext)
  }
}

/**
 * Reset a specific mock to its original class.
 * @param {string|Class} clazzOrName The singleton or factory class or name to reset
 */
export function resetMock(clazzOrName) {
  const instanceContext = singletons.get(clazzOrName) ?? factories.get(clazzOrName)
  reset(instanceContext)
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
  if (instanceContext.original) {
    instanceContext.clazz = instanceContext.original
    delete instanceContext.original
    delete instanceContext.instance
  }
}
