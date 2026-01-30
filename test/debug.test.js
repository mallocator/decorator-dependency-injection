import {
  Singleton,
  Factory,
  Inject,
  Mock,
  clearContainer,
  setDebug,
  getContainer
} from '../index.js'

describe('Debug Mode', () => {
  let consoleSpy

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    setDebug(false)
    consoleSpy.mockRestore()
    clearContainer()
  })

  it('should not log when debug is disabled', () => {
    setDebug(false)

    @Singleton()
    class TestService {}

    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it('should log registration when debug is enabled', () => {
    setDebug(true)

    @Singleton()
    class DebugService {}

    expect(consoleSpy).toHaveBeenCalledWith('[DI] Registered singleton: DebugService')
  })

  it('should log factory registration when debug is enabled', () => {
    setDebug(true)

    @Factory()
    class DebugFactory {}

    expect(consoleSpy).toHaveBeenCalledWith('[DI] Registered factory: DebugFactory')
  })

  it('should log instance creation when debug is enabled', () => {
    @Singleton()
    class CreateService {}

    setDebug(true)

    class Consumer {
      @Inject(CreateService) service
    }

    new Consumer()

    expect(consoleSpy).toHaveBeenCalledWith('[DI] Creating singleton: CreateService')
  })

  it('should log cached singleton return when debug is enabled', () => {
    @Singleton()
    class CachedService {}

    class Consumer {
      @Inject(CachedService) service
    }

    new Consumer() // First creation

    setDebug(true)
    consoleSpy.mockClear()

    new Consumer() // Second access - should be cached

    expect(consoleSpy).toHaveBeenCalledWith('[DI] Returning cached singleton: CachedService')
  })

  it('should log mock registration when debug is enabled', () => {
    @Singleton()
    class OriginalService {}

    setDebug(true)
    consoleSpy.mockClear()

    @Mock(OriginalService)
    class MockService {}

    expect(consoleSpy).toHaveBeenCalledWith('[DI] Mocked OriginalService with MockService')
  })

  it('should log proxy mock registration when debug is enabled', () => {
    @Singleton()
    class ProxyOriginal {}

    setDebug(true)
    consoleSpy.mockClear()

    @Mock(ProxyOriginal, true)
    class ProxyMock {}

    expect(consoleSpy).toHaveBeenCalledWith('[DI] Mocked ProxyOriginal with ProxyMock (proxy)')
  })

  it('should work with container.setDebug as well', () => {
    const container = getContainer()
    container.setDebug(true)

    @Singleton()
    class ContainerDebugService {}

    expect(consoleSpy).toHaveBeenCalledWith('[DI] Registered singleton: ContainerDebugService')
  })
})
