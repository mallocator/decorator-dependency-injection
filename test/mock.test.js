import {Factory, Inject, InjectLazy, Mock, resetMock, resetMocks, Singleton} from '../index.js'

describe('Mocking', () => {
  @Singleton()
  class ToBeMockedSingleton {
    op() {
      return 'original'
    }

    op2() {
      return 'original2'
    }
  }

  class TestInjection {
    @Inject(ToBeMockedSingleton) toBeMockedSingleton
  }

  afterEach(() => {
    resetMocks()
  })

  it('should inject a mock singleton', () => {
    @Mock(ToBeMockedSingleton)
    class MockedSingleton {
      op() {
        return 'mocked1'
      }
    }

    const result = new TestInjection()
    expect(result.toBeMockedSingleton.op()).toBe('mocked1')
    expect(result.toBeMockedSingleton.op2).toBe.undefined

    resetMocks()
    const result2 = new TestInjection()
    expect(result2.toBeMockedSingleton.op()).toBe('original')
    expect(result2.toBeMockedSingleton.op2()).toBe('original2')
  })

  // New tests for lazy injection with mocks (non-proxied)
  it('should inject a lazy mock singleton', () => {
    @Mock(ToBeMockedSingleton)
    class MockedSingletonLazy {
      op() {
        return 'mocked2'
      }
    }

    class TestInjectionLazy {
      @InjectLazy(ToBeMockedSingleton) lazyMockedSingleton
    }

    const instance = new TestInjectionLazy()
    const result = instance.lazyMockedSingleton
    expect(result.op()).toBe('mocked2')
    expect(result.op2).toBe.undefined

    resetMocks()
    const instance2 = new TestInjectionLazy()
    expect(instance2.lazyMockedSingleton.op()).toBe('original')
    expect(instance2.lazyMockedSingleton.op2()).toBe('original2')
  })

  @Factory()
  class ToBeMockedFactory {
    op() {
      return 'original'
    }
  }

  class TestInjectionFactory {
    @Inject(ToBeMockedFactory) toBeMockedFactory
  }

  it('should inject a mock factory', () => {
    @Mock(ToBeMockedFactory)
    class MockedFactory {
      op() {
        return 'mocked'
      }
    }

    const result = new TestInjectionFactory()
    expect(result.toBeMockedFactory.op()).toBe('mocked')

    resetMocks()
    const result2 = new TestInjectionFactory()
    expect(result2.toBeMockedFactory.op()).toBe('original')
  })

  // New tests for lazy injection with mock factory
  it('should inject a lazy mock factory', () => {
    @Mock(ToBeMockedFactory)
    class MockedFactoryLazy {
      op() {
        return 'mocked'
      }
    }

    class TestInjectionFactoryLazy {
      @InjectLazy(ToBeMockedFactory) lazyMockedFactory
    }

    const instance = new TestInjectionFactoryLazy()
    const result = instance.lazyMockedFactory
    expect(result.op()).toBe('mocked')

    resetMocks()
    const instance2 = new TestInjectionFactoryLazy()
    expect(instance2.lazyMockedFactory.op()).toBe('original')
  })

  it('should throw an error if a mock is not a singleton or factory', () => {
    expect(() => {
      @Mock(ToBeMockedFactory)
      class Mocked1 {
      }

      @Mock(ToBeMockedFactory)
      class Mocked2 {
      }
    }).toThrow('Mock already defined, reset before mocking again')
  })

  // Edge case: Resetting specific mocks
  it('should reset only the specified mock', () => {
    @Singleton()
    class A {
      value() {
        return 'A'
      }
    }

    @Singleton()
    class B {
      value() {
        return 'B'
      }
    }

    @Mock(A)
    class MockA {
      value() {
        return 'mockA'
      }
    }

    @Mock(B)
    class MockB {
      value() {
        return 'mockB'
      }
    }

    class Test {
      @Inject(A) a
      @Inject(B) b
    }

    const t = new Test()
    expect(t.a.value()).toBe('mockA')
    expect(t.b.value()).toBe('mockB')

    resetMock(A)
    const t2 = new Test()
    expect(t2.a.value()).toBe('A')
    expect(t2.b.value()).toBe('mockB')
  })

  it('should use the latest mock when multiple mocks are applied', () => {
    @Singleton()
    class Original {
    }

    @Mock(Original)
    class Mock1 {
    }

    resetMock(Original)

    @Mock(Original)
    class Mock2 {
    }

    class Test {
      @Inject(Original) dep
    }

    const t = new Test()
    expect(t.dep).toBeInstanceOf(Mock2)
  })

  it('should restore the original after unmocking', () => {
    @Singleton()
    class Orig {
    }

    @Mock(Orig)
    class Mocked {
    }

    resetMock(Orig)

    class Test {
      @Inject(Orig) dep
    }

    const t = new Test()
    expect(t.dep).toBeInstanceOf(Orig)
  })

  it('should inject subclass correctly', () => {
    @Singleton()
    class Base {
    }

    class Sub extends Base {
    }

    @Mock(Base)
    class SubMock extends Sub {
    }

    class Test {
      @Inject(Base) dep
    }

    const t = new Test()
    expect(t.dep).toBeInstanceOf(Sub)
  })

  it('should use latest mock for lazy injection', () => {
    @Singleton()
    class Orig {
    }

    @Mock(Orig)
    class Mock1 {
    }

    resetMock(Orig)

    @Mock(Orig)
    class Mock2 {
    }

    class Test {
      @InjectLazy(Orig) dep
    }

    const t = new Test()
    expect(t.dep).toBeInstanceOf(Mock2)
  })

  it('should restore original after unmocking (lazy)', () => {
    @Singleton()
    class Orig {
    }

    @Mock(Orig)
    class Mocked {
    }

    resetMock(Orig)

    class Test {
      @InjectLazy(Orig) dep
    }

    const t = new Test()
    expect(t.dep).toBeInstanceOf(Orig)
  })

  it('should inject subclass correctly (lazy)', () => {
    @Singleton()
    class Base {
    }

    class Sub extends Base {
    }

    @Mock(Base)
    class SubMock extends Sub {
    }

    class Test {
      @InjectLazy(Base) dep
    }

    const t = new Test()
    expect(t.dep).toBeInstanceOf(Sub)
  })
})

