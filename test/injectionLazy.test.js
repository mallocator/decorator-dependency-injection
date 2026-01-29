import {Factory, InjectLazy, resetMocks, Singleton} from '../index.js'

describe('Lazy Injection via fields', () => {
  @Singleton()
  class TestLazySingleton {
    static calls = 0

    constructor() {
      TestLazySingleton.calls++
    }
  }

  it('should lazily inject singleton', () => {
    class TestLazySingletonInjection {
      @InjectLazy(TestLazySingleton) testSingleton

      constructor() {
      }
    }

    const instance = new TestLazySingletonInjection()
    expect(TestLazySingleton.calls).toBe(0) // Not constructed until access
    const first = instance.testSingleton
    expect(first).toBeInstanceOf(TestLazySingleton)
    expect(TestLazySingleton.calls).toBe(1)
    // Repeated access returns the same instance.
    const second = instance.testSingleton
    expect(first).toBe(second)
  })

  @Factory()
  class TestLazyFactory {
    static calls = 0
    params

    constructor(...params) {
      TestLazyFactory.calls++
      this.params = params
    }
  }

  afterEach(() => {
    TestLazyFactory.calls = 0
    TestLazySingleton.calls = 0
    resetMocks()
  })

  it('should throw when attempting to assign to lazy-injected field', () => {
    class TestLazySetterError {
      @InjectLazy(TestLazySingleton) lazyProp
    }

    const instance = new TestLazySetterError()
    expect(() => {
      instance.lazyProp = 'something'
    }).toThrow('Cannot assign value to lazy-injected field "lazyProp"')
  })

  it('should lazily inject factory with caching on first access per field', () => {
    class TestLazyFactoryInjection {
      @InjectLazy(TestLazyFactory) testFactory

      constructor() {
      }
    }

    const inst = new TestLazyFactoryInjection()
    expect(TestLazyFactory.calls).toBe(0)
    const first = inst.testFactory
    expect(first).toBeInstanceOf(TestLazyFactory)
    expect(TestLazyFactory.calls).toBe(1)
    expect(inst.testFactory).toBe(first)
  })

  it('should create distinct factory instances for different fields', () => {
    class TestMultipleLazyFactoryInjection {
      @InjectLazy(TestLazyFactory) testFactory1
      @InjectLazy(TestLazyFactory) testFactory2

      constructor() {
      }
    }

    const instance = new TestMultipleLazyFactoryInjection()
    expect(TestLazyFactory.calls).toBe(0)
    const one = instance.testFactory1
    const two = instance.testFactory2
    expect(one).toBeInstanceOf(TestLazyFactory)
    expect(two).toBeInstanceOf(TestLazyFactory)
    expect(one).not.toBe(two)
  })

  it('should pass constructor parameters when using lazy injection', () => {
    class TestLazyFactoryParamsInjection {
      @InjectLazy(TestLazyFactory, 'param1', 'param2') testFactory

      constructor() {
      }
    }

    TestLazyFactory.calls = 0
    const instance = new TestLazyFactoryParamsInjection()
    expect(TestLazyFactory.calls).toBe(0)
    const factoryInst = instance.testFactory
    expect(factoryInst).toBeInstanceOf(TestLazyFactory)
    expect(factoryInst.params).toEqual(['param1', 'param2'])
  })

  it('should not initialize dependency if property is never accessed', () => {
    class TestNeverAccess {
      @InjectLazy(TestLazySingleton) testSingleton

      constructor() {
      }
    }

    TestLazySingleton.calls = 0
    new TestNeverAccess() // Do not access testSingleton.
    expect(TestLazySingleton.calls).toBe(0)
  })

  @Singleton('lazyNamedSingleton')
  class NamedLazySingleton {
    static calls = 0

    constructor() {
      NamedLazySingleton.calls++
    }
  }

  it('should lazily inject named singleton', () => {
    class TestLazyNamedSingletonInjection {
      @InjectLazy('lazyNamedSingleton') namedSingleton

      constructor() {
      }
    }

    const instance = new TestLazyNamedSingletonInjection()
    expect(NamedLazySingleton.calls).toBe(0)
    const first = instance.namedSingleton
    expect(first).toBeInstanceOf(NamedLazySingleton)
    expect(NamedLazySingleton.calls).toBe(1)
    expect(instance.namedSingleton).toBe(first)
  })

  @Factory('lazyNamedFactory')
  class NamedLazyFactory {
    static calls = 0
    params

    constructor(...params) {
      NamedLazyFactory.calls++
      this.params = params
    }
  }

  it('should lazily inject named factory', () => {
    class TestLazyNamedFactoryInjection {
      @InjectLazy('lazyNamedFactory') namedFactory

      constructor() {
      }
    }

    NamedLazyFactory.calls = 0
    const instance = new TestLazyNamedFactoryInjection()
    expect(NamedLazyFactory.calls).toBe(0)
    const first = instance.namedFactory
    expect(first).toBeInstanceOf(NamedLazyFactory)
    expect(NamedLazyFactory.calls).toBe(1)
    expect(instance.namedFactory).toBe(first)
  })

  it('should not expose any internal caching artifacts', () => {
    class TestLazyEnum {
      @InjectLazy(TestLazySingleton) lazyProp

      constructor() {
      }
    }

    const inst = new TestLazyEnum()
    // noinspection JSUnusedLocalSymbols: Force lazy initialization.
    const _ = inst.lazyProp
    const keys = Object.keys(inst)
    expect(keys).toContain('lazyProp')
    expect(keys.length).toBe(1)
    const symbols = Object.getOwnPropertySymbols(inst)
    expect(symbols.length).toBe(0)
  })

  it('should throw if @InjectLazy is applied to a method', () => {
    expect(() => {
      // noinspection JSUnusedLocalSymbols
      class BadLazy {
        @InjectLazy('something')
        someMethod() {
        }
      }
    }).toThrow()
  })

  it('should handle circular dependencies (lazy)', () => {
    @Singleton()
    class A {
      @InjectLazy('B') b
    }

    @Singleton('B')
    class B {
      @InjectLazy(A) a
    }

    expect(() => new A()).not.toThrow()
  })

  it('should inject into symbol-named fields (lazy)', () => {
    const sym = Symbol('sym')

    @Singleton()
    class S {
    }

    class Test {
      @InjectLazy(S) [sym]
    }

    const t = new Test()
    expect(t[sym]).toBeInstanceOf(S)
  })

  it('should not leak lazy injected properties to prototype', () => {
    @Singleton()
    class S {
    }

    class Test {
      @InjectLazy(S) dep
    }

    // noinspection JSUnusedLocalSymbols
    const t = new Test()
    expect(Object.prototype.hasOwnProperty.call(Test.prototype, 'dep')).toBe(false)
  })

  it('should allow circular dependencies with lazy injection', () => {
    @Singleton()
    class A1 {
      @InjectLazy('B1') b
    }

    @Factory('B1')
    class B1 {
      @InjectLazy(A1) a
    }

    expect(() => new A1()).not.toThrow()
  })
})