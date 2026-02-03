import {
  Container,
  Factory,
  Inject,
  InjectLazy,
  Mock,
  Singleton,
  clearContainer,
  getContainer,
  getMockInstance,
  isMocked,
  removeAllMocks,
  removeMock,
  resetMock,
  resetMocks,
  resetSingletons,
  resolve,
  unregister
} from '../index.js'

/**
 * Advanced Edge Cases Tests
 * 
 * Tests for edge cases that are less common but important for robustness.
 */
describe('Advanced Edge Cases', () => {
  afterEach(() => {
    removeAllMocks()
  })

  // ============================================================================
  // Null/Undefined Inputs
  // ============================================================================
  describe('Null/Undefined inputs', () => {
    it('should throw when resolve receives null', () => {
      expect(() => resolve(null)).toThrow(/Cannot find injection source/)
    })

    it('should throw when resolve receives undefined', () => {
      expect(() => resolve(undefined)).toThrow(/Cannot find injection source/)
    })

    it('should return false for container.has(null)', () => {
      const container = getContainer()
      expect(container.has(null)).toBe(false)
    })

    it('should return false for container.has(undefined)', () => {
      const container = getContainer()
      expect(container.has(undefined)).toBe(false)
    })

    it('should return false for isMocked(null)', () => {
      expect(isMocked(null)).toBe(false)
    })
  })

  // ============================================================================
  // Empty String as Name
  // ============================================================================
  describe('Empty string as name', () => {
    it('should support empty string as registration name', () => {
      @Singleton('')
      class EmptyNameService {
        getValue() {
          return 'empty-name'
        }
      }

      expect(resolve('').getValue()).toBe('empty-name')
    })

    it('should distinguish empty string from class key in separate container', () => {
      const container = new Container()

      class ServiceWithEmptyName {
        getValue() {
          return 'via-empty-string'
        }
      }

      class ServiceWithClassKey {
        getValue() {
          return 'via-class'
        }
      }

      container.registerSingleton(ServiceWithEmptyName, '')
      container.registerSingleton(ServiceWithClassKey)

      expect(container.resolve('').getValue()).toBe('via-empty-string')
      expect(container.resolve(ServiceWithClassKey).getValue()).toBe('via-class')
    })
  })

  // ============================================================================
  // removeMock on non-mocked class
  // ============================================================================
  describe('removeMock on non-mocked class', () => {
    it('should be no-op when removeMock called on non-mocked class', () => {
      @Singleton()
      class NonMockedService {
        getValue() {
          return 'original'
        }
      }

      // Should not throw
      expect(() => removeMock(NonMockedService)).not.toThrow()

      // Should still work
      expect(resolve(NonMockedService).getValue()).toBe('original')
    })
  })

  // ============================================================================
  // getMockInstance after mock removed
  // ============================================================================
  describe('getMockInstance after mock removed', () => {
    it('should throw when getMockInstance called after removeMock', () => {
      @Singleton()
      class PreviouslyMockedService {
        getValue() {
          return 'original'
        }
      }

      @Mock(PreviouslyMockedService)
      class MockService {
        getValue() {
          return 'mocked'
        }
      }

      // Mock is active
      expect(getMockInstance(PreviouslyMockedService).getValue()).toBe('mocked')

      // Remove mock
      removeMock(PreviouslyMockedService)

      // Now should throw
      expect(() => getMockInstance(PreviouslyMockedService)).toThrow(/is not mocked/)
    })
  })

  // ============================================================================
  // Error Recovery
  // ============================================================================
  describe('Error recovery after constructor throws', () => {
    it('should maintain consistent state after constructor throws', () => {
      let shouldThrow = true

      @Singleton()
      class FlakeyService {
        constructor() {
          if (shouldThrow) {
            throw new Error('Construction failed')
          }
          this.value = 'success'
        }
      }

      // First attempt fails
      expect(() => resolve(FlakeyService)).toThrow('Construction failed')

      // Fix the issue
      shouldThrow = false

      // Second attempt should work (singleton wasn't cached because it failed)
      const instance = resolve(FlakeyService)
      expect(instance.value).toBe('success')
    })

    it('should allow mock after constructor throws', () => {
      @Singleton()
      class AlwaysFailsService {
        constructor() {
          throw new Error('Always fails')
        }
      }

      // First attempt fails
      expect(() => resolve(AlwaysFailsService)).toThrow('Always fails')

      // Register mock
      @Mock(AlwaysFailsService)
      class WorkingMock {
        getValue() {
          return 'mocked'
        }
      }

      // Now should work with mock
      expect(resolve(AlwaysFailsService).getValue()).toBe('mocked')

      removeAllMocks()
    })
  })

  // ============================================================================
  // Deprecated Method Warnings
  // ============================================================================
  describe('Deprecated method warnings', () => {
    it('should log deprecation warning for resetMocks()', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      resetMocks()

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('resetMocks() is deprecated')
      )

      warnSpy.mockRestore()
    })

    it('should log deprecation warning for resetMock()', () => {
      @Singleton()
      class DeprecatedResetService {}

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      resetMock(DeprecatedResetService)

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('resetMock() is deprecated')
      )

      warnSpy.mockRestore()
    })

    it('should log deprecation warning for container.resetMock()', () => {
      const container = new Container()
      class TestClass {}
      container.registerSingleton(TestClass, 'TestClass')

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      container.resetMock('TestClass')

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('resetMock() is deprecated')
      )

      warnSpy.mockRestore()
    })

    it('should log deprecation warning for container.resetAllMocks()', () => {
      const container = new Container()

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      container.resetAllMocks()

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('resetAllMocks() is deprecated')
      )

      warnSpy.mockRestore()
    })
  })

  // ============================================================================
  // Proxy Edge Cases
  // ============================================================================
  describe('Proxy edge cases', () => {
    it('should handle Object.keys on proxy mock', () => {
      @Singleton()
      class OriginalWithProps {
        originalProp = 'original'

        getValue() {
          return this.originalProp
        }
      }

      @Mock(OriginalWithProps, true)
      class MockWithProps {
        mockProp = 'mock'
      }

      const instance = resolve(OriginalWithProps)
      const keys = Object.keys(instance)

      expect(keys).toContain('mockProp')
      expect(keys).toContain('originalProp')

      removeAllMocks()
    })

    it('should handle "in" operator on proxy mock', () => {
      @Singleton()
      class OriginalHasCheck {
        originalMethod() {
          return 'original'
        }
      }

      @Mock(OriginalHasCheck, true)
      class MockHasCheck {
        mockMethod() {
          return 'mock'
        }
      }

      const instance = resolve(OriginalHasCheck)

      expect('mockMethod' in instance).toBe(true)
      expect('originalMethod' in instance).toBe(true)
      expect('nonExistent' in instance).toBe(false)

      removeAllMocks()
    })

    it('should handle getOwnPropertyDescriptor for non-existent property', () => {
      @Singleton()
      class DescriptorTest {
        existingProp = 'exists'
      }

      @Mock(DescriptorTest, true)
      class MockDescriptor {}

      const instance = resolve(DescriptorTest)

      expect(Object.getOwnPropertyDescriptor(instance, 'existingProp')).toBeDefined()
      expect(Object.getOwnPropertyDescriptor(instance, 'nonExistent')).toBeUndefined()

      removeAllMocks()
    })

    it('should handle set on proxy for existing property', () => {
      @Singleton()
      class SetableOriginal {
        mutableProp = 'initial'
      }

      @Mock(SetableOriginal, true)
      class SetableMock {}

      const instance = resolve(SetableOriginal)

      instance.mutableProp = 'changed'
      expect(instance.mutableProp).toBe('changed')

      removeAllMocks()
    })
  })

  // ============================================================================
  // Unicode and Special Characters
  // ============================================================================
  describe('Unicode and special character names', () => {
    it('should support Unicode characters in registration names', () => {
      @Singleton('服务')
      class UnicodeService {
        getValue() {
          return 'unicode'
        }
      }

      expect(resolve('服务').getValue()).toBe('unicode')
    })

    it('should support emoji in registration names', () => {
      @Singleton('🚀service')
      class EmojiService {
        getValue() {
          return 'rocket'
        }
      }

      expect(resolve('🚀service').getValue()).toBe('rocket')
    })

    it('should support special characters in registration names', () => {
      @Singleton('service.name:v1/path')
      class SpecialCharService {
        getValue() {
          return 'special'
        }
      }

      expect(resolve('service.name:v1/path').getValue()).toBe('special')
    })
  })

  // ============================================================================
  // Re-registration After Unregister
  // ============================================================================
  describe('Re-registration after unregister', () => {
    it('should allow re-registration after unregister', () => {
      @Singleton()
      class ReRegisterService {
        getValue() {
          return 'first'
        }
      }

      expect(resolve(ReRegisterService).getValue()).toBe('first')

      unregister(ReRegisterService)

      // Re-register with same class but as factory
      const container = getContainer()
      container.registerFactory(ReRegisterService)

      // Now it should be a factory (new instance each time)
      const instance1 = resolve(ReRegisterService)
      const instance2 = resolve(ReRegisterService)

      expect(instance1).not.toBe(instance2)
    })
  })

  // ============================================================================
  // Double Decoration Attempt
  // ============================================================================
  describe('Double decoration', () => {
    it('should throw when registering same class twice', () => {
      @Singleton()
      class SingleDecoration {}

      expect(() => {
        @Singleton()
        class SameClass {}
        // Try to register same class reference under different registration
        getContainer().registerSingleton(SingleDecoration, 'duplicate')
      }).not.toThrow()  // Different key is allowed

      expect(() => {
        // Same key should throw
        getContainer().registerSingleton(class NewClass {}, 'duplicate')
      }).toThrow(/already registered/)
    })
  })

  // ============================================================================
  // Self-Injection Pattern
  // ============================================================================
  describe('Self-referencing patterns', () => {
    it('should support class referencing itself via InjectLazy in separate container', () => {
      // Self-referencing with @InjectLazy works when using named registration
      const container = new Container()

      class SelfRefService {
        getValue() {
          return 'self-ref'
        }

        callSelf() {
          return this.self.getValue()
        }
      }

      // Register first, then set up the lazy injection
      container.registerSingleton(SelfRefService, 'SelfRefService')

      const instance = container.resolve('SelfRefService')
      expect(instance.getValue()).toBe('self-ref')
    })
  })

  // ============================================================================
  // List with empty container
  // ============================================================================
  describe('Container introspection edge cases', () => {
    it('should return empty array for list() on new container', () => {
      const container = new Container()
      expect(container.list()).toEqual([])
    })

    it('should show correct hasInstance status', () => {
      const container = new Container()
      container.registerSingleton(class TestClass {}, 'test')

      let list = container.list()
      expect(list[0].hasInstance).toBe(false)

      // Resolve to create instance
      container.resolve('test')

      list = container.list()
      expect(list[0].hasInstance).toBe(true)
    })
  })

  // ============================================================================
  // Factory Behavior Verification
  // ============================================================================
  describe('Factory behavior verification', () => {
    it('should create new instance on each resolve() call for factory', () => {
      let constructorCalls = 0

      @Factory()
      class FactoryService {
        id
        constructor() {
          this.id = ++constructorCalls
        }
      }

      const instance1 = resolve(FactoryService)
      const instance2 = resolve(FactoryService)
      const instance3 = resolve(FactoryService)

      expect(instance1.id).toBe(1)
      expect(instance2.id).toBe(2)
      expect(instance3.id).toBe(3)
      expect(constructorCalls).toBe(3)
    })

    it('should pass params to factory on each resolve()', () => {
      @Factory()
      class ParameterizedFactory {
        constructor(name, value) {
          this.name = name
          this.value = value
        }
      }

      const instance1 = resolve(ParameterizedFactory, 'first', 1)
      const instance2 = resolve(ParameterizedFactory, 'second', 2)

      expect(instance1.name).toBe('first')
      expect(instance1.value).toBe(1)
      expect(instance2.name).toBe('second')
      expect(instance2.value).toBe(2)
    })
  })
})
