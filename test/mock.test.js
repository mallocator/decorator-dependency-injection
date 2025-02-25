import {resetMocks, Inject, Mock, Singleton, Factory} from '../index.js'

describe('Mocking', () => {
  @Singleton()
  class ToBeMockedSingleton {
    op() {
      return 'original'
    }
  }

  class TestInjection {
    @Inject(ToBeMockedSingleton) toBeMockedSingleton
  }

  it('should inject a mock singleton', () => {
    @Mock(ToBeMockedSingleton)
    class MockedSingleton {
      op() {
        return 'mocked'
      }
    }

    const result = new TestInjection()
    expect(result.toBeMockedSingleton.op()).toBe('mocked')

    resetMocks()
    const result2 = new TestInjection()
    expect(result2.toBeMockedSingleton.op()).toBe('original')
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
})