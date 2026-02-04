import {
  Container,
  Factory,
  Inject,
  InjectLazy,
  Mock,
  Singleton,
  getContainer,
  getMockInstance,
  isMocked,
  removeAllMocks,
  removeMock,
  resetSingletons,
  resolve,
  unregister
} from '../index.js'

describe('Edge Cases', () => {
  afterEach(() => {
    removeAllMocks()
  })

  @Singleton()
  class TestDep {
    value = 'test-value'
  }

  @Factory()
  class FactoryDep {
    static count = 0
    id = ++FactoryDep.count
  }

  beforeEach(() => {
    FactoryDep.count = 0
  })

  // ============================================================================
  // Invalid Targets (should throw)
  // ============================================================================
  describe('Invalid decorator targets', () => {
    it('should reject @Inject on getter', () => {
      expect(() => {
        class _GetterTest {
          @Inject(TestDep) get dep() {
            return null
          }
        }
      }).toThrow('Invalid injection target')
    })

    it('should reject @Inject on setter', () => {
      expect(() => {
        class _SetterTest {
          @Inject(TestDep) set dep(_value) {}
        }
      }).toThrow('Invalid injection target')
    })

    it('should reject @Inject on method', () => {
      expect(() => {
        class _MethodTest {
          @Inject(TestDep) myMethod() {}
        }
      }).toThrow('Invalid injection target')
    })
  })

  // ============================================================================
  // Inheritance
  // ============================================================================
  describe('Inheritance', () => {
    it('should work with inherited injected fields', () => {
      class BaseClass {
        @Inject(TestDep) baseDep
      }

      class DerivedClass extends BaseClass {
        @Inject(FactoryDep) derivedDep

        getValues() {
          return {
            base: this.baseDep?.value,
            derived: this.derivedDep?.id
          }
        }
      }

      const instance = new DerivedClass()
      const values = instance.getValues()

      expect(values.base).toBe('test-value')
      expect(values.derived).toBe(1)
    })

    it('should allow overriding injected fields in subclass', () => {
      @Factory()
      class OverrideDep {
        source = 'base'
      }

      class BaseClass {
        @Inject(OverrideDep) dep
      }

      class DerivedClass extends BaseClass {
        @Inject(TestDep) dep  // Override with different type
      }

      const base = new BaseClass()
      const derived = new DerivedClass()

      expect(base.dep.source).toBe('base')
      expect(derived.dep.value).toBe('test-value')
    })
  })

  // ============================================================================
  // Computed Property Names
  // ============================================================================
  describe('Computed property names', () => {
    it('should work with computed property names', () => {
      const propName = 'dynamicDep'

      class ComputedPropTest {
        @Inject(TestDep) [propName]

        getValue() {
          return this[propName]?.value
        }
      }

      const instance = new ComputedPropTest()
      expect(instance.getValue()).toBe('test-value')
      expect(instance.dynamicDep).toBeInstanceOf(TestDep)
    })

    it('should work with Symbol property names', () => {
      const symProp = Symbol('injectedDep')

      class SymbolPropTest {
        @Inject(TestDep) [symProp]

        getValue() {
          return this[symProp]?.value
        }
      }

      const instance = new SymbolPropTest()
      expect(instance.getValue()).toBe('test-value')
    })
  })

  // ============================================================================
  // Multiple Decorators
  // ============================================================================
  describe('Multiple decorators', () => {
    function TrackInit(_target, context) {
      if (context.kind === 'field') {
        return function(initialValue) {
          return initialValue
        }
      }
    }

    it('should work with multiple decorators on same field', () => {
      class MultiDecoratorTest {
        @TrackInit
        @Inject(TestDep)
        dep
      }

      const instance = new MultiDecoratorTest()
      expect(instance.dep).toBeInstanceOf(TestDep)
    })
  })

  // ============================================================================
  // Nested Injection
  // ============================================================================
  describe('Nested injection', () => {
    @Singleton()
    class ServiceA {
      value = 'A'
    }

    @Singleton()
    class ServiceB {
      @Inject(ServiceA) serviceA

      getValue() {
        return `B uses ${this.serviceA?.value}`
      }
    }

    it('should support injection into singleton classes', () => {
      class Consumer {
        @Inject(ServiceB) serviceB
      }

      const instance = new Consumer()
      expect(instance.serviceB.getValue()).toBe('B uses A')
    })
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
      expect(getContainer().has(null)).toBe(false)
    })

    it('should return false for container.has(undefined)', () => {
      expect(getContainer().has(undefined)).toBe(false)
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
        getValue() { return 'empty-name' }
      }

      expect(resolve('').getValue()).toBe('empty-name')
    })

    it('should distinguish empty string from class key in separate container', () => {
      const container = new Container()

      class ServiceWithEmptyName {
        getValue() { return 'via-empty-string' }
      }

      class ServiceWithClassKey {
        getValue() { return 'via-class' }
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
        getValue() { return 'original' }
      }

      expect(() => removeMock(NonMockedService)).not.toThrow()
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
        getValue() { return 'original' }
      }

      @Mock(PreviouslyMockedService)
      class MockService {
        getValue() { return 'mocked' }
      }

      expect(getMockInstance(PreviouslyMockedService).getValue()).toBe('mocked')
      removeMock(PreviouslyMockedService)
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
          if (shouldThrow) throw new Error('Construction failed')
          this.value = 'success'
        }
      }

      expect(() => resolve(FlakeyService)).toThrow('Construction failed')
      shouldThrow = false
      expect(resolve(FlakeyService).value).toBe('success')
    })

    it('should allow mock after constructor throws', () => {
      @Singleton()
      class AlwaysFailsService {
        constructor() { throw new Error('Always fails') }
      }

      expect(() => resolve(AlwaysFailsService)).toThrow('Always fails')

      @Mock(AlwaysFailsService)
      class WorkingMock {
        getValue() { return 'mocked' }
      }

      expect(resolve(AlwaysFailsService).getValue()).toBe('mocked')
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
        getValue() { return this.originalProp }
      }

      @Mock(OriginalWithProps, true)
      class MockWithProps {
        mockProp = 'mock'
      }

      const keys = Object.keys(resolve(OriginalWithProps))
      expect(keys).toContain('mockProp')
      expect(keys).toContain('originalProp')
    })

    it('should handle "in" operator on proxy mock', () => {
      @Singleton()
      class OriginalHasCheck {
        originalMethod() { return 'original' }
      }

      @Mock(OriginalHasCheck, true)
      class MockHasCheck {
        mockMethod() { return 'mock' }
      }

      const instance = resolve(OriginalHasCheck)
      expect('mockMethod' in instance).toBe(true)
      expect('originalMethod' in instance).toBe(true)
      expect('nonExistent' in instance).toBe(false)
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
    })
  })

  // ============================================================================
  // Unicode and Special Characters
  // ============================================================================
  describe('Unicode and special character names', () => {
    it('should support Unicode characters in registration names', () => {
      @Singleton('服务')
      class UnicodeService {
        getValue() { return 'unicode' }
      }

      expect(resolve('服务').getValue()).toBe('unicode')
    })

    it('should support emoji in registration names', () => {
      @Singleton('🚀service')
      class EmojiService {
        getValue() { return 'rocket' }
      }

      expect(resolve('🚀service').getValue()).toBe('rocket')
    })

    it('should support special characters in registration names', () => {
      @Singleton('service.name:v1/path')
      class SpecialCharService {
        getValue() { return 'special' }
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
        getValue() { return 'first' }
      }

      expect(resolve(ReRegisterService).getValue()).toBe('first')
      unregister(ReRegisterService)
      getContainer().registerFactory(ReRegisterService)

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
        class _SameClass {}
        getContainer().registerSingleton(SingleDecoration, 'duplicate')
      }).not.toThrow()

      expect(() => {
        getContainer().registerSingleton(class NewClass {}, 'duplicate')
      }).toThrow(/already registered/)
    })
  })

  // ============================================================================
  // Self-Injection Pattern
  // ============================================================================
  describe('Self-referencing patterns', () => {
    it('should support class referencing itself via InjectLazy in separate container', () => {
      const container = new Container()

      class SelfRefService {
        getValue() { return 'self-ref' }
        callSelf() { return this.self.getValue() }
      }

      container.registerSingleton(SelfRefService, 'SelfRefService')
      expect(container.resolve('SelfRefService').getValue()).toBe('self-ref')
    })
  })

  // ============================================================================
  // Container introspection edge cases
  // ============================================================================
  describe('Container introspection edge cases', () => {
    it('should return empty array for list() on new container', () => {
      expect(new Container().list()).toEqual([])
    })

    it('should show correct hasInstance status', () => {
      const container = new Container()
      container.registerSingleton(class TestClass {}, 'test')

      expect(container.list()[0].hasInstance).toBe(false)
      container.resolve('test')
      expect(container.list()[0].hasInstance).toBe(true)
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
        constructor() { this.id = ++constructorCalls }
      }

      expect(resolve(FactoryService).id).toBe(1)
      expect(resolve(FactoryService).id).toBe(2)
      expect(resolve(FactoryService).id).toBe(3)
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
