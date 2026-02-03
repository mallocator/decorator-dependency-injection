import {
  Factory,
  Inject,
  Mock,
  Singleton,
  clearContainer,
  getContainer,
  getMockInstance,
  isMocked,
  listRegistrations,
  removeAllMocks,
  removeMock,
  resetSingletons,
  resolve,
  unregister
} from '../index.js'

describe('Mock Lifecycle', () => {
  describe('removeMock and removeAllMocks', () => {
    @Singleton()
    class ServiceA {
      getValue() {
        return 'original-a'
      }
    }

    @Singleton()
    class ServiceB {
      getValue() {
        return 'original-b'
      }
    }

    afterEach(() => {
      removeAllMocks()
    })

    it('should remove a specific mock with removeMock()', () => {
      @Mock(ServiceA)
      class MockServiceA {
        getValue() {
          return 'mocked-a'
        }
      }

      // Mock is active
      expect(resolve(ServiceA).getValue()).toBe('mocked-a')

      // Remove the mock
      removeMock(ServiceA)

      // Original is restored
      expect(resolve(ServiceA).getValue()).toBe('original-a')
    })

    it('should remove all mocks with removeAllMocks()', () => {
      @Mock(ServiceA)
      class MockA {
        getValue() {
          return 'mocked-a'
        }
      }

      @Mock(ServiceB)
      class MockB {
        getValue() {
          return 'mocked-b'
        }
      }

      // Mocks are active
      expect(resolve(ServiceA).getValue()).toBe('mocked-a')
      expect(resolve(ServiceB).getValue()).toBe('mocked-b')

      // Remove all mocks
      removeAllMocks()

      // Originals are restored
      expect(resolve(ServiceA).getValue()).toBe('original-a')
      expect(resolve(ServiceB).getValue()).toBe('original-b')
    })
  })

  describe('resetSingletons', () => {
    let creationCount = 0

    @Singleton()
    class CountingService {
      id
      constructor() {
        this.id = ++creationCount
      }

      getId() {
        return this.id
      }
    }

    beforeEach(() => {
      creationCount = 0
    })

    afterEach(() => {
      removeAllMocks()
      resetSingletons()
    })

    it('should reset singleton instances', () => {
      // First resolve creates instance
      const instance1 = resolve(CountingService)
      expect(instance1.getId()).toBe(1)

      // Same instance returned
      const instance2 = resolve(CountingService)
      expect(instance2.getId()).toBe(1)
      expect(instance1).toBe(instance2)

      // Reset singletons
      resetSingletons()

      // New instance created
      const instance3 = resolve(CountingService)
      expect(instance3.getId()).toBe(2)
      expect(instance3).not.toBe(instance1)
    })

    it('should preserve mocks by default when resetting singletons', () => {
      @Mock(CountingService)
      class MockCountingService {
        getId() {
          return 999
        }
      }

      // Mock is active
      expect(resolve(CountingService).getId()).toBe(999)

      // Reset singletons (preserves mocks by default)
      resetSingletons()

      // Mock is still active
      expect(resolve(CountingService).getId()).toBe(999)
    })

    it('should remove mocks when preserveMocks is false', () => {
      @Mock(CountingService)
      class MockCountingService {
        getId() {
          return 999
        }
      }

      // Mock is active
      expect(resolve(CountingService).getId()).toBe(999)

      // Reset singletons with preserveMocks: false
      resetSingletons({ preserveMocks: false })

      // Original is restored
      expect(resolve(CountingService).getId()).toBe(1)
    })
  })

  describe('clearContainer with preserveRegistrations', () => {
    @Singleton()
    class ClearTestService {
      getValue() {
        return 'original'
      }
    }

    afterEach(() => {
      removeAllMocks()
    })

    it('should clear instances but keep registrations when preserveRegistrations is true', () => {
      @Mock(ClearTestService)
      class MockClearTestService {
        getValue() {
          return 'mocked'
        }
      }

      // Mock is active
      expect(resolve(ClearTestService).getValue()).toBe('mocked')

      // Clear with preserveRegistrations
      clearContainer({ preserveRegistrations: true })

      // Mock is still active (fresh instance)
      expect(resolve(ClearTestService).getValue()).toBe('mocked')
    })
  })

  describe('getMockInstance', () => {
    @Singleton()
    class GetMockTestService {
      doSomething() {
        return 'original'
      }
    }

    afterEach(() => {
      removeAllMocks()
    })

    it('should return the mock instance', () => {
      @Mock(GetMockTestService)
      class MockGetMockTestService {
        doSomething() {
          return 'mocked'
        }

        mockOnlyMethod() {
          return 'mock-only'
        }
      }

      const mockInstance = getMockInstance(GetMockTestService)

      expect(mockInstance.doSomething()).toBe('mocked')
      expect(mockInstance.mockOnlyMethod()).toBe('mock-only')
    })

    it('should throw if class is not mocked', () => {
      expect(() => getMockInstance(GetMockTestService)).toThrow(
        '"GetMockTestService" is not mocked'
      )
    })
  })

  describe('isMocked', () => {
    @Singleton()
    class IsMockedTestService {
      getValue() {
        return 'original'
      }
    }

    afterEach(() => {
      removeAllMocks()
    })

    it('should return false when not mocked', () => {
      expect(isMocked(IsMockedTestService)).toBe(false)
    })

    it('should return true when mocked', () => {
      @Mock(IsMockedTestService)
      class MockIsMockedTestService {
        getValue() {
          return 'mocked'
        }
      }

      expect(isMocked(IsMockedTestService)).toBe(true)
    })

    it('should return false after mock is removed', () => {
      @Mock(IsMockedTestService)
      class MockIsMockedTestService {
        getValue() {
          return 'mocked'
        }
      }

      expect(isMocked(IsMockedTestService)).toBe(true)

      removeMock(IsMockedTestService)

      expect(isMocked(IsMockedTestService)).toBe(false)
    })

    it('should return false for unregistered class', () => {
      class UnregisteredService {}

      expect(isMocked(UnregisteredService)).toBe(false)
    })
  })

  describe('Improved error messages', () => {
    it('should suggest @Mock for mock-like class names', () => {
      class MockSomeService {}

      expect(() => resolve(MockSomeService)).toThrow(/Hint:.*@Mock/)
    })

    it('should suggest @Mock for class names containing Mock', () => {
      class UserServiceMock {}

      expect(() => resolve(UserServiceMock)).toThrow(/Hint:.*@Mock/)
    })

    it('should not add hint for regular class names', () => {
      class RegularService {}

      expect(() => resolve(RegularService)).toThrow(/Cannot find injection source/)
      expect(() => resolve(RegularService)).not.toThrow(/Hint/)
    })
  })

  describe('Container methods', () => {
    it('should have removeMock method on container', () => {
      const container = getContainer()

      @Singleton()
      class ContainerTestService {
        getValue() {
          return 'original'
        }
      }

      @Mock(ContainerTestService)
      class MockContainerTestService {
        getValue() {
          return 'mocked'
        }
      }

      expect(container.resolve(ContainerTestService).getValue()).toBe('mocked')

      container.removeMock(ContainerTestService)

      expect(container.resolve(ContainerTestService).getValue()).toBe('original')
    })

    it('should have removeAllMocks method on container', () => {
      const container = getContainer()

      @Singleton()
      class ContainerTestService2 {
        getValue() {
          return 'original'
        }
      }

      @Mock(ContainerTestService2)
      class MockContainerTestService2 {
        getValue() {
          return 'mocked'
        }
      }

      expect(container.resolve(ContainerTestService2).getValue()).toBe('mocked')

      container.removeAllMocks()

      expect(container.resolve(ContainerTestService2).getValue()).toBe('original')
    })

    it('should have isMocked method on container', () => {
      const container = getContainer()

      @Singleton()
      class ContainerTestService3 {
        getValue() {
          return 'original'
        }
      }

      expect(container.isMocked(ContainerTestService3)).toBe(false)

      @Mock(ContainerTestService3)
      class MockContainerTestService3 {
        getValue() {
          return 'mocked'
        }
      }

      expect(container.isMocked(ContainerTestService3)).toBe(true)

      container.removeMock(ContainerTestService3)

      expect(container.isMocked(ContainerTestService3)).toBe(false)
    })

    it('should have getMockInstance method on container', () => {
      const container = getContainer()

      @Singleton()
      class ContainerTestService4 {
        getValue() {
          return 'original'
        }
      }

      @Mock(ContainerTestService4)
      class MockContainerTestService4 {
        getValue() {
          return 'mocked'
        }
      }

      const mockInstance = container.getMockInstance(ContainerTestService4)
      expect(mockInstance.getValue()).toBe('mocked')

      container.removeMock(ContainerTestService4)
    })

    it('should have resetSingletons method on container', () => {
      const container = getContainer()
      let count = 0

      @Singleton()
      class ContainerTestService5 {
        id
        constructor() {
          this.id = ++count
        }
      }

      const instance1 = container.resolve(ContainerTestService5)
      expect(instance1.id).toBe(1)

      container.resetSingletons()

      const instance2 = container.resolve(ContainerTestService5)
      expect(instance2.id).toBe(2)
    })
  })

  describe('unregister', () => {
    it('should unregister a class', () => {
      @Singleton()
      class UnregisterTestService {
        getValue() {
          return 'test'
        }
      }

      // Can resolve
      expect(resolve(UnregisterTestService).getValue()).toBe('test')

      // Unregister
      const result = unregister(UnregisterTestService)
      expect(result).toBe(true)

      // Cannot resolve anymore
      expect(() => resolve(UnregisterTestService)).toThrow(/Cannot find injection source/)
    })

    it('should return false if not registered', () => {
      class NotRegisteredService {}

      const result = unregister(NotRegisteredService)
      expect(result).toBe(false)
    })
  })

  describe('listRegistrations', () => {
    it('should list all registrations', () => {
      @Singleton()
      class ListTestService1 {}

      @Factory()
      class ListTestService2 {}

      const registrations = listRegistrations()

      const service1 = registrations.find(r => r.name === 'ListTestService1')
      expect(service1).toBeDefined()
      expect(service1.type).toBe('singleton')
      expect(service1.isMocked).toBe(false)

      const service2 = registrations.find(r => r.name === 'ListTestService2')
      expect(service2).toBeDefined()
      expect(service2.type).toBe('factory')
    })

    it('should show mocked status', () => {
      @Singleton()
      class ListMockTestService {}

      @Mock(ListMockTestService)
      class MockListMockTestService {}

      const registrations = listRegistrations()
      const service = registrations.find(r => r.name === 'ListMockTestService')

      expect(service.isMocked).toBe(true)

      removeAllMocks()
    })
  })

  describe('Mocked singleton caching', () => {
    it('should cache mocked singleton instances', () => {
      let constructorCalls = 0

      @Singleton()
      class CachedMockService {
        getValue() {
          return 'original'
        }
      }

      @Mock(CachedMockService)
      class MockCachedMockService {
        id
        constructor() {
          constructorCalls++
          this.id = constructorCalls
        }
        getValue() {
          return 'mocked'
        }
      }

      // First resolve - creates instance
      const instance1 = resolve(CachedMockService)
      expect(instance1.getValue()).toBe('mocked')
      expect(instance1.id).toBe(1)

      // Second resolve - should return cached instance
      const instance2 = resolve(CachedMockService)
      expect(instance2.getValue()).toBe('mocked')
      expect(instance2.id).toBe(1) // Same instance
      expect(instance1).toBe(instance2)

      // Constructor should only be called once
      expect(constructorCalls).toBe(1)

      removeAllMocks()
    })
  })

  describe('Proxy instanceof', () => {
    it('should pass instanceof check for original class with proxy mock', () => {
      @Singleton()
      class InstanceOfTestService {
        getValue() {
          return 'original'
        }
      }

      @Mock(InstanceOfTestService, true) // proxy = true
      class MockInstanceOfTestService {
        getValue() {
          return 'mocked'
        }
      }

      const instance = resolve(InstanceOfTestService)

      expect(instance.getValue()).toBe('mocked')
      expect(instance instanceof InstanceOfTestService).toBe(true)

      removeAllMocks()
    })
  })

  describe('Edge cases for coverage', () => {
    it('should handle getMockInstance with string name', () => {
      @Singleton('namedMockService')
      class NamedMockService {
        getValue() {
          return 'original'
        }
      }

      @Mock('namedMockService')
      class MockNamedService {
        getValue() {
          return 'mocked'
        }
      }

      const mockInstance = getMockInstance('namedMockService')
      expect(mockInstance.getValue()).toBe('mocked')

      removeAllMocks()
    })

    it('should throw when getMockInstance called with string for non-mocked', () => {
      @Singleton('notMockedService')
      class NotMockedService {}

      expect(() => getMockInstance('notMockedService')).toThrow(
        '"notMockedService" is not mocked'
      )
    })

    it('should log when unregistering with debug enabled', () => {
      const container = getContainer()
      const originalDebug = container.setDebug

      @Singleton()
      class DebugUnregisterService {}

      container.setDebug(true)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      unregister(DebugUnregisterService)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unregistered')
      )

      consoleSpy.mockRestore()
      container.setDebug(false)
    })

    it('should rethrow non-RangeError from constructor', () => {
      @Singleton()
      class ThrowingService {
        constructor() {
          throw new TypeError('Custom error')
        }
      }

      expect(() => resolve(ThrowingService)).toThrow('Custom error')
      expect(() => resolve(ThrowingService)).toThrow(TypeError)
    })

    it('should log when clearing with debug enabled', () => {
      const container = getContainer()

      @Singleton()
      class DebugClearService {}

      container.setDebug(true)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      container.clear({ preserveRegistrations: true })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleared instances')
      )

      container.clear()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all registrations')
      )

      consoleSpy.mockRestore()
      container.setDebug(false)
    })
  })
})
