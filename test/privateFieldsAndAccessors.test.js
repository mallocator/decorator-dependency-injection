import {Inject, InjectLazy, resetMocks, Singleton, Factory} from '../index.js'

/**
 * Private Field and Accessor Injection Tests
 * 
 * This test suite verifies that injection decorators work correctly with:
 * - Public fields
 * - Private fields (#field)
 * - Public accessors (accessor field)
 * - Private accessors (accessor #field)
 */
describe('Private Field and Accessor Injection', () => {
  afterEach(() => {
    resetMocks()
  })

  @Singleton()
  class PrivateDep {
    value = 'private-dep-value'
  }

  @Factory()
  class FactoryDep {
    static instanceCount = 0
    instanceId

    constructor() {
      this.instanceId = ++FactoryDep.instanceCount
    }
  }

  beforeEach(() => {
    FactoryDep.instanceCount = 0
  })

  // ============================================================================
  // @Inject Tests
  // ============================================================================
  describe('@Inject decorator', () => {
    describe('with public fields', () => {
      it('should inject into public field', () => {
        class PublicFieldInjection {
          @Inject(PrivateDep) publicDep

          getValue() {
            return this.publicDep.value
          }
        }

        const instance = new PublicFieldInjection()
        expect(instance.getValue()).toBe('private-dep-value')
        expect(instance.publicDep).toBeInstanceOf(PrivateDep)
      })
    })

    describe('with private fields (#field)', () => {
      it('should inject into private field', () => {
        class PrivateFieldInjection {
          @Inject(PrivateDep) #privateDep

          getValue() {
            return this.#privateDep.value
          }

          getDep() {
            return this.#privateDep
          }
        }

        const instance = new PrivateFieldInjection()
        expect(instance.getValue()).toBe('private-dep-value')
        expect(instance.getDep()).toBeInstanceOf(PrivateDep)

        // Verify it's truly private
        expect(instance['#privateDep']).toBeUndefined()
        expect(Object.keys(instance)).not.toContain('#privateDep')
      })

      it('should inject factory into private field', () => {
        class PrivateFactoryInjection {
          @Inject(FactoryDep) #factory1
          @Inject(FactoryDep) #factory2

          getFactory1Id() {
            return this.#factory1.instanceId
          }

          getFactory2Id() {
            return this.#factory2.instanceId
          }
        }

        const instance = new PrivateFactoryInjection()
        expect(instance.getFactory1Id()).toBe(1)
        expect(instance.getFactory2Id()).toBe(2)
      })
    })

    describe('with accessor keyword', () => {
      it('should inject into public accessor', () => {
        class AccessorInjection {
          @Inject(PrivateDep) accessor myDep

          getValue() {
            return this.myDep.value
          }
        }

        const instance = new AccessorInjection()
        expect(instance.getValue()).toBe('private-dep-value')
        expect(instance.myDep).toBeInstanceOf(PrivateDep)
      })

      it('should inject into private accessor', () => {
        class PrivateAccessorInjection {
          @Inject(PrivateDep) accessor #privateAccessorDep

          getValue() {
            return this.#privateAccessorDep.value
          }

          getDep() {
            return this.#privateAccessorDep
          }
        }

        const instance = new PrivateAccessorInjection()
        expect(instance.getValue()).toBe('private-dep-value')
        expect(instance.getDep()).toBeInstanceOf(PrivateDep)
      })

      it('should prevent assignment to injected accessor', () => {
        class ReadOnlyAccessorInjection {
          @Inject(PrivateDep) accessor myDep
        }

        const instance = new ReadOnlyAccessorInjection()
        expect(() => {
          instance.myDep = 'something'
        }).toThrow(/Cannot assign value/)
      })
    })
  })

  // ============================================================================
  // @InjectLazy Tests
  // ============================================================================
  describe('@InjectLazy decorator', () => {
    // Use a factory for lazy tests to accurately count instantiations
    @Factory()
    class LazyFactoryDep {
      static instantiationCount = 0
      value = 'lazy-value'

      constructor() {
        LazyFactoryDep.instantiationCount++
      }
    }

    beforeEach(() => {
      LazyFactoryDep.instantiationCount = 0
    })

    describe('with public fields', () => {
      it('should lazily inject into public field', () => {
        class LazyPublicInjection {
          @InjectLazy(LazyFactoryDep) lazyDep

          getValue() {
            return this.lazyDep.value
          }
        }

        const instance = new LazyPublicInjection()
        expect(LazyFactoryDep.instantiationCount).toBe(0) // Not yet instantiated

        const value = instance.getValue()
        expect(LazyFactoryDep.instantiationCount).toBe(1)
        expect(value).toBe('lazy-value')

        // Subsequent accesses don't create new instances
        instance.getValue()
        expect(LazyFactoryDep.instantiationCount).toBe(1)
      })
    })

    describe('with private fields (#field)', () => {
      it('should inject into private field (note: not truly lazy for private fields)', () => {
        // Due to limitations with private fields, @InjectLazy behaves like @Inject
        // For true lazy behavior with private fields, use accessor syntax
        class LazyPrivateInjection {
          @InjectLazy(LazyFactoryDep) #lazyPrivateDep

          getValue() {
            return this.#lazyPrivateDep.value
          }
        }

        const instance = new LazyPrivateInjection()
        // For private fields, instantiation happens at class instantiation time
        expect(LazyFactoryDep.instantiationCount).toBe(1)
        expect(instance.getValue()).toBe('lazy-value')
      })
    })

    describe('with accessor keyword (recommended for lazy private)', () => {
      it('should lazily inject into public accessor', () => {
        class LazyAccessorInjection {
          @InjectLazy(LazyFactoryDep) accessor lazyAccessorDep

          getValue() {
            return this.lazyAccessorDep.value
          }
        }

        const instance = new LazyAccessorInjection()
        expect(LazyFactoryDep.instantiationCount).toBe(0)

        const value = instance.getValue()
        expect(LazyFactoryDep.instantiationCount).toBe(1)
        expect(value).toBe('lazy-value')
      })

      it('should lazily inject into private accessor', () => {
        class LazyPrivateAccessorInjection {
          @InjectLazy(LazyFactoryDep) accessor #lazyPrivateAccessorDep

          getValue() {
            return this.#lazyPrivateAccessorDep.value
          }
        }

        const instance = new LazyPrivateAccessorInjection()
        expect(LazyFactoryDep.instantiationCount).toBe(0) // Truly lazy!

        const value = instance.getValue()
        expect(LazyFactoryDep.instantiationCount).toBe(1)
        expect(value).toBe('lazy-value')

        // Cached on subsequent accesses
        instance.getValue()
        expect(LazyFactoryDep.instantiationCount).toBe(1)
      })

      it('should prevent assignment to lazy accessor', () => {
        @Factory()
        class PreventAssignDep {
          value = 'test'
        }

        class ReadOnlyLazyAccessor {
          @InjectLazy(PreventAssignDep) accessor lazyDep
        }

        const instance = new ReadOnlyLazyAccessor()
        expect(() => {
          instance.lazyDep = 'something'
        }).toThrow(/Cannot assign value/)
      })
    })
  })
})
