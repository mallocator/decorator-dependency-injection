import {Factory, Inject, resetMocks, Singleton} from '../index.js'

describe('Injection via fields', () => {
  @Singleton()
  class TestSingleton {
    static calls = 0

    constructor() {
      TestSingleton.calls++
    }
  }

  it('should inject singleton', () => {
    class TestInjection {
      @Inject(TestSingleton) testSingleton

      constructor() {
        expect(this.testSingleton).toBeInstanceOf(TestSingleton)
        expect(TestSingleton.calls).toBe(1)
      }
    }

    class TestInjection2 {
      @Inject(TestSingleton) testSingleton

      constructor() {
        expect(this.testSingleton).toBeInstanceOf(TestSingleton)
        expect(TestSingleton.calls).toBe(1)
      }
    }

    new TestInjection()
    new TestInjection2()
  })

  @Factory()
  class TestFactory {
    static calls = 0
    params

    @Inject(TestSingleton) testSingleton

    constructor(...params) {
      TestFactory.calls++
      this.params = params
    }
  }

  afterEach(() => {
    TestFactory.calls = 0
    TestSingleton.calls = 0
    resetMocks()
  })

  it('should inject factory', () => {
    class TestInjectionFactory {
      @Inject(TestFactory) testFactory

      constructor() {
        expect(this.testFactory).toBeInstanceOf(TestFactory)
        expect(TestFactory.calls).toBe(1)
      }
    }

    class TestInjectionFactory2 {
      @Inject(TestFactory) testFactory

      constructor() {
        expect(this.testFactory).toBeInstanceOf(TestFactory)
        expect(TestFactory.calls).toBe(2)
      }
    }

    const result = new TestInjectionFactory()
    new TestInjectionFactory2()
    expect(result.testFactory.testSingleton).toBeInstanceOf(TestSingleton)
  })

  it('should inject factory with parameters', () => {
    class TestInjectionFactoryParams {
      @Inject(TestFactory, 'param1', 'param2') testFactory

      constructor() {
        expect(this.testFactory).toBeInstanceOf(TestFactory)
        expect(this.testFactory.params).toEqual(['param1', 'param2'])
      }
    }

    new TestInjectionFactoryParams()
  })

  it('should cache factory instance on repeated accesses', () => {
    class TestRepeatedFactoryAccess {
      @Inject(TestFactory) testFactory

      constructor() {
        const instance1 = this.testFactory
        const instance2 = this.testFactory
        expect(instance1).toBe(instance2)
      }
    }

    new TestRepeatedFactoryAccess()
  })

  it('should create distinct factory instances for different fields in the same object', () => {
    class TestMultipleFactoryInjection {
      @Inject(TestFactory) testFactory1
      @Inject(TestFactory) testFactory2

      constructor() {
        // Access both properties to trigger initialization.
        const one = this.testFactory1
        const two = this.testFactory2
        expect(one).not.toBe(two)
      }
    }

    new TestMultipleFactoryInjection()
  })

  it('should inject the same singleton instance for different fields in the same object', () => {
    class TestMultipleSingletonInjection {
      @Inject(TestSingleton) testSingleton1
      @Inject(TestSingleton) testSingleton2

      constructor() {
        // Access both properties to trigger initialization.
        const one = this.testSingleton1
        const two = this.testSingleton2
        expect(one).toBe(two)
      }
    }

    new TestMultipleSingletonInjection()
  })

  @Singleton('named')
  class NamedSingleton {
    static calls = 0

    constructor() {
      NamedSingleton.calls++
    }
  }

  it('should inject named singleton', () => {
    class TestInjectionNamedSingleton {
      @Inject('named') namedSingleton

      constructor() {
        expect(this.namedSingleton).toBeInstanceOf(NamedSingleton)
        expect(NamedSingleton.calls).toBe(1)
      }
    }

    class TestInjectionNamedSingleton2 {
      @Inject('named') namedSingleton

      constructor() {
        expect(this.namedSingleton).toBeInstanceOf(NamedSingleton)
        expect(NamedSingleton.calls).toBe(1)
      }
    }

    new TestInjectionNamedSingleton()
    new TestInjectionNamedSingleton2()
  })

  @Factory('named2')
  class NamedFactory {
    static calls = 0
    params

    constructor(...params) {
      NamedFactory.calls++
      this.params = params
    }
  }

  it('should inject named factory', () => {
    class TestInjectionNamedFactory {
      @Inject('named2') namedFactory

      constructor() {
        expect(this.namedFactory).toBeInstanceOf(NamedFactory)
        expect(NamedFactory.calls).toBe(1)
      }
    }

    class TestInjectionNamedFactory2 {
      @Inject('named2') namedFactory

      constructor() {
        expect(this.namedFactory).toBeInstanceOf(NamedFactory)
        expect(NamedFactory.calls).toBe(2)
      }
    }

    const result = new TestInjectionNamedFactory()
    new TestInjectionNamedFactory2()
    expect(result.namedFactory.params).toEqual([])
  })

  it('should cache named factory instance on repeated accesses', () => {
    class TestRepeatedNamedFactoryAccess {
      @Inject('named2') namedFactory

      constructor() {
        const instance1 = this.namedFactory
        const instance2 = this.namedFactory
        expect(instance1).toBe(instance2)
      }
    }

    new TestRepeatedNamedFactoryAccess()
  })

  it('should throw if @Inject is applied to a method', () => {
    expect(() => {
      // noinspection JSUnusedLocalSymbols
      class BadInjection {
        @Inject('something')
        someMethod() {
        }
      }
    }).toThrow()
  })

  it('should handle circular dependencies gracefully', () => {
    @Singleton()
    class A {
      @Inject('B') b
    }

    @Singleton('B')
    class B {
      @Inject(A) a
    }

    expect(() => new A()).toThrow(/Circular dependency detected.*@InjectLazy/)
  })

  it('should throw if decorator is used on non-class object', () => {
    expect(() => {
      const obj = {}
      Inject('something')(obj, 'field')
    }).toThrow()
  })

  it('should throw a helpful error for eager circular dependencies', () => {
    @Factory()
    class A2 {
      @Inject('B2') b
    }

    @Singleton('B2')
    class B2 {
      @Inject(A2) a
    }

    expect(() => new A2()).toThrow(/Circular dependency detected.*@InjectLazy/)
  })

  it('should inject into symbol-named fields', () => {
    const sym = Symbol('sym')

    @Singleton()
    class S {
    }

    class Test {
      @Inject(S) [sym]
    }

    const t = new Test()
    expect(t[sym]).toBeInstanceOf(S)
  })

  it('should not leak injected properties to prototype', () => {
    @Singleton()
    class S {
    }

    class Test {
      @Inject(S) dep
    }

    // noinspection JSUnusedLocalSymbols
    const t = new Test()
    expect(Object.prototype.hasOwnProperty.call(Test.prototype, 'dep')).toBe(false)
  })

  it('should handle undefined/null/complex params in factory', () => {
    @Factory()
    class F {
      constructor(...params) {
        this.params = params
      }
    }

    class Test {
      @Inject(F, undefined, null, {a: 1}) dep
    }

    const t = new Test()
    expect(t.dep.params).toEqual([undefined, null, {a: 1}])
  })
})