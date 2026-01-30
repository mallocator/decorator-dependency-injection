import {Inject, resetMocks, Singleton, Factory} from '../index.js'

/**
 * Edge Cases Tests
 * 
 * Tests for various decorator contexts: inheritance, computed properties,
 * multiple decorators, invalid targets, etc.
 */
describe('Edge Cases', () => {
  afterEach(() => {
    resetMocks()
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
          // Track initialization but pass through the value
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
})
