import {Inject, InjectLazy, resetMocks, Singleton, Factory} from '../index.js'

/**
 * Static Field Injection Tests
 * 
 * Testing static field edge cases more thoroughly
 */
describe('Static Field Injection', () => {
  afterEach(() => {
    resetMocks()
  })

  @Factory()
  class CountingDep {
    static count = 0
    id = ++CountingDep.count
  }

  beforeEach(() => {
    CountingDep.count = 0
  })

  describe('@Inject with static fields', () => {
    it('should inject into static field', () => {
      class StaticInject {
        @Inject(CountingDep) static dep
      }

      // Static field should have the injected value
      expect(StaticInject.dep).toBeInstanceOf(CountingDep)
      expect(StaticInject.dep.id).toBe(1)

      // Multiple accesses should return same instance (cached on the class)
      expect(StaticInject.dep.id).toBe(1)
    })

    it('should share static injection across instances', () => {
      class StaticShared {
        @Inject(CountingDep) static sharedDep
        @Inject(CountingDep) instanceDep

        getIds() {
          return {
            static: StaticShared.sharedDep.id,
            instance: this.instanceDep.id
          }
        }
      }

      const a = new StaticShared()
      const b = new StaticShared()

      // Static should be shared (same id)
      expect(StaticShared.sharedDep.id).toBe(1)
      
      // Instance deps should be different (factory creates new each time)
      expect(a.instanceDep.id).toBe(2)
      expect(b.instanceDep.id).toBe(3)
    })
  })

  describe('@InjectLazy with static fields', () => {
    it('should lazily inject into static field', () => {
      class LazyStatic {
        @InjectLazy(CountingDep) static lazyDep
      }

      // Should not be created yet
      expect(CountingDep.count).toBe(0)

      // First access triggers creation
      const dep = LazyStatic.lazyDep
      expect(CountingDep.count).toBe(1)
      expect(dep.id).toBe(1)

      // Subsequent accesses should return cached
      expect(LazyStatic.lazyDep.id).toBe(1)
      expect(CountingDep.count).toBe(1)
    })

    it('should test lazy static private field (NOT truly lazy - same as instance private)', () => {
      class LazyStaticPrivate {
        @InjectLazy(CountingDep) static #lazyPrivateDep

        static getValue() {
          return this.#lazyPrivateDep.id
        }
      }

      // For static private fields, lazy does NOT work (created at class definition)
      // This is the same limitation as instance private fields
      expect(CountingDep.count).toBe(1) // Already created!
      
      const id = LazyStaticPrivate.getValue()
      expect(id).toBe(1)
    })
  })

  describe('@InjectLazy with static accessor (truly lazy)', () => {
    it('should lazily inject into static accessor', () => {
      class LazyStaticAccessor {
        @InjectLazy(CountingDep) static accessor lazyDep
      }

      // Should not be created yet
      expect(CountingDep.count).toBe(0)

      // First access triggers creation
      const dep = LazyStaticAccessor.lazyDep
      expect(CountingDep.count).toBe(1)
      expect(dep.id).toBe(1)
    })

    it('should lazily inject into static private accessor (truly lazy)', () => {
      class LazyStaticPrivateAccessor {
        @InjectLazy(CountingDep) static accessor #lazyDep

        static getValue() {
          return this.#lazyDep.id
        }
      }

      // Should not be created yet
      expect(CountingDep.count).toBe(0)

      // First access triggers creation
      const id = LazyStaticPrivateAccessor.getValue()
      expect(CountingDep.count).toBe(1)
      expect(id).toBe(1)
    })
  })
})
