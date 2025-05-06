import {Factory, Inject, InjectLazy, Mock, resetMocks, Singleton} from '../index.js'

describe('Proxy Mocking', () => {
  @Singleton()
  class ToBeProxiedSingleton {
    op() {
      return 'original'
    }

    op2() {
      return 'original2'
    }
  }

  class TestInjection {
    @Inject(ToBeProxiedSingleton) toBeProxiedSingleton
  }

  afterEach(() => {
    resetMocks()
  })

  it('should inject a proxy singleton', () => {
    @Mock(ToBeProxiedSingleton, true)
    class ProxiedSingleton {
      op() {
        return 'mocked'
      }
    }

    const result = new TestInjection()
    expect(result.toBeProxiedSingleton.op()).toBe('mocked')
    expect(result.toBeProxiedSingleton.op2()).toBe('original2')

    resetMocks()
    const result2 = new TestInjection()
    expect(result2.toBeProxiedSingleton.op()).toBe('original')
    expect(result2.toBeProxiedSingleton.op2()).toBe('original2')
  })

  @Factory()
  class ToBeProxiedFactory {
    op() {
      return 'original'
    }

    op2() {
      return 'original2'
    }
  }

  class TestInjectionFactory {
    @Inject(ToBeProxiedFactory) toBeProxiedFactory
  }

  it('should inject a proxy factory', () => {
    @Mock(ToBeProxiedFactory, true)
    class ProxiedFactory {
      op() {
        return 'mocked'
      }
    }

    const result = new TestInjectionFactory()
    expect(result.toBeProxiedFactory.op()).toBe('mocked')
    expect(result.toBeProxiedFactory.op2()).toBe('original2')

    resetMocks()
    const result2 = new TestInjectionFactory()
    expect(result2.toBeProxiedFactory.op()).toBe('original')
    expect(result2.toBeProxiedFactory.op2()).toBe('original2')
  })

  it('should inject a lazy proxy singleton', () => {
    @Mock(ToBeProxiedSingleton, true)
    class ProxiedSingletonLazy {
      op() {
        return 'mocked'
      }
    }

    class TestInjectionLazy {
      @InjectLazy(ToBeProxiedSingleton) lazyProxiedSingleton
    }

    const instance = new TestInjectionLazy()
    const result = instance.lazyProxiedSingleton
    expect(result.op()).toBe('mocked')
    expect(result.op2()).toBe('original2')

    resetMocks()
    const instance2 = new TestInjectionLazy()
    expect(instance2.lazyProxiedSingleton.op()).toBe('original')
    expect(instance2.lazyProxiedSingleton.op2()).toBe('original2')
  })

  it('should inject a lazy proxy factory', () => {
    @Factory()
    class ToBeProxiedFactoryLazy {
      op() {
        return 'original'
      }

      op2() {
        return 'original2'
      }
    }

    class TestInjectionFactoryLazy {
      @InjectLazy(ToBeProxiedFactoryLazy) lazyProxiedFactory
    }

    @Mock(ToBeProxiedFactoryLazy, true)
    class ProxiedFactoryLazy {
      op() {
        return 'mocked'
      }
    }

    const instance = new TestInjectionFactoryLazy()
    const result = instance.lazyProxiedFactory
    expect(result.op()).toBe('mocked')
    expect(result.op2()).toBe('original2')

    resetMocks()
    const instance2 = new TestInjectionFactoryLazy()
    expect(instance2.lazyProxiedFactory.op()).toBe('original')
    expect(instance2.lazyProxiedFactory.op2()).toBe('original2')
  })
})
