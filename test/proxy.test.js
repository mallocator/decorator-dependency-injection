import {resetMocks, Inject, Mock, Singleton, Factory} from '../index.js'

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
})