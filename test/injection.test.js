import {Factory, Inject, Singleton} from '../index.js'

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

  @Singleton("named")
  class NamedSingleton {
    static calls = 0

    constructor() {
      NamedSingleton.calls++
    }
  }

  it('should inject named singleton', () => {
    class TestInjectionNamedSingleton {
      @Inject("named") namedSingleton

      constructor() {
        expect(this.namedSingleton).toBeInstanceOf(NamedSingleton)
        expect(NamedSingleton.calls).toBe(1)
      }
    }

    class TestInjectionNamedSingleton2 {
      @Inject("named") namedSingleton

      constructor() {
        expect(this.namedSingleton).toBeInstanceOf(NamedSingleton)
        expect(NamedSingleton.calls).toBe(1)
      }
    }

    new TestInjectionNamedSingleton()
    new TestInjectionNamedSingleton2()
  })

  @Factory("named2")
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
      @Inject("named2") namedFactory

      constructor() {
        expect(this.namedFactory).toBeInstanceOf(NamedFactory)
        expect(NamedFactory.calls).toBe(1)
      }
    }

    class TestInjectionNamedFactory2 {
      @Inject("named2") namedFactory

      constructor() {
        expect(this.namedFactory).toBeInstanceOf(NamedFactory)
        expect(NamedFactory.calls).toBe(2)
      }
    }

    const result = new TestInjectionNamedFactory()
    new TestInjectionNamedFactory2()
    expect(result.namedFactory.params).toEqual([])
  })
})