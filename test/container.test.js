import {Container} from '../src/Container.js'
import {clearContainer, getContainer} from '../index.js'

describe('Container', () => {
  describe('Basic Registration', () => {
    let container

    beforeEach(() => {
      container = new Container()
    })

    it('should register a singleton', () => {
      class MySingleton {}
      container.registerSingleton(MySingleton)
      expect(container.has(MySingleton)).toBe(true)
    })

    it('should register a factory', () => {
      class MyFactory {}
      container.registerFactory(MyFactory)
      expect(container.has(MyFactory)).toBe(true)
    })

    it('should register with a custom name', () => {
      class MyClass {}
      container.registerSingleton(MyClass, 'customName')
      expect(container.has('customName')).toBe(true)
      expect(container.has(MyClass)).toBe(false)
    })

    it('should throw when registering duplicate names', () => {
      class MyClass {}
      class AnotherClass {}
      container.registerSingleton(MyClass, 'sameName')
      expect(() => container.registerFactory(AnotherClass, 'sameName')).toThrow(
        'A different class is already registered under this name'
      )
    })

    it('should throw when registering duplicate class references', () => {
      class MyClass {}
      container.registerSingleton(MyClass)
      expect(() => container.registerSingleton(MyClass)).toThrow(
        'A different class is already registered under this name'
      )
    })
  })

  describe('Instance Creation', () => {
    let container

    beforeEach(() => {
      container = new Container()
    })

    it('should create singleton instance only once', () => {
      let callCount = 0
      class MySingleton {
        constructor() {
          callCount++
        }
      }
      container.registerSingleton(MySingleton)

      const context = container.getContext(MySingleton)
      const instance1 = container.getInstance(context, [])
      const instance2 = container.getInstance(context, [])

      expect(instance1).toBe(instance2)
      expect(callCount).toBe(1)
    })

    it('should create new factory instance each time', () => {
      let callCount = 0
      class MyFactory {
        constructor() {
          callCount++
        }
      }
      container.registerFactory(MyFactory)

      const context = container.getContext(MyFactory)
      const instance1 = container.getInstance(context, [])
      const instance2 = container.getInstance(context, [])

      expect(instance1).not.toBe(instance2)
      expect(callCount).toBe(2)
    })

    it('should pass constructor parameters', () => {
      class MyFactory {
        constructor(a, b) {
          this.a = a
          this.b = b
        }
      }
      container.registerFactory(MyFactory)

      const context = container.getContext(MyFactory)
      const instance = container.getInstance(context, ['hello', 42])

      expect(instance.a).toBe('hello')
      expect(instance.b).toBe(42)
    })

    it('should throw when getting context for unregistered class', () => {
      class Unregistered {}
      expect(() => container.getContext(Unregistered)).toThrow(
        'Cannot find injection source for "Unregistered"'
      )
    })

    it('should list available registrations in error message', () => {
      class RegisteredOne {}
      class RegisteredTwo {}
      class Unregistered {}

      container.registerSingleton(RegisteredOne)
      container.registerFactory(RegisteredTwo, 'customTwo')

      try {
        container.getContext(Unregistered)
        fail('Expected an error to be thrown')
      } catch (err) {
        expect(err.message).toContain('RegisteredOne')
        expect(err.message).toContain('customTwo')
      }
    })
  })

  describe('Mocking', () => {
    let container

    beforeEach(() => {
      container = new Container()
    })

    it('should replace class with mock', () => {
      class Original {
        getValue() {
          return 'original'
        }
      }
      class MockClass {
        getValue() {
          return 'mocked'
        }
      }

      container.registerSingleton(Original)
      container.registerMock(Original, MockClass)

      const context = container.getContext(Original)
      const instance = container.getInstance(context, [])

      expect(instance.getValue()).toBe('mocked')
    })

    it('should reset mock to original', () => {
      class Original {
        getValue() {
          return 'original'
        }
      }
      class MockClass {
        getValue() {
          return 'mocked'
        }
      }

      container.registerSingleton(Original)
      container.registerMock(Original, MockClass)
      container.resetMock(Original)

      const context = container.getContext(Original)
      const instance = container.getInstance(context, [])

      expect(instance.getValue()).toBe('original')
    })

    it('should reset all mocks', () => {
      class Original1 {
        getValue() {
          return 'original1'
        }
      }
      class Original2 {
        getValue() {
          return 'original2'
        }
      }
      class Mock1 {
        getValue() {
          return 'mocked1'
        }
      }
      class Mock2 {
        getValue() {
          return 'mocked2'
        }
      }

      container.registerSingleton(Original1)
      container.registerFactory(Original2)
      container.registerMock(Original1, Mock1)
      container.registerMock(Original2, Mock2)

      container.resetAllMocks()

      const context1 = container.getContext(Original1)
      const context2 = container.getContext(Original2)

      expect(container.getInstance(context1, []).getValue()).toBe('original1')
      expect(container.getInstance(context2, []).getValue()).toBe('original2')
    })

    it('should throw when mocking already mocked class', () => {
      class Original {}
      class Mock1 {}
      class Mock2 {}

      container.registerSingleton(Original)
      container.registerMock(Original, Mock1)

      expect(() => container.registerMock(Original, Mock2)).toThrow(
        'Mock already defined, reset before mocking again'
      )
    })

    it('should support proxy mocking', () => {
      class Original {
        method1() {
          return 'original1'
        }
        method2() {
          return 'original2'
        }
      }
      class PartialMock {
        method1() {
          return 'mocked1'
        }
      }

      container.registerSingleton(Original)
      container.registerMock(Original, PartialMock, true)

      const context = container.getContext(Original)
      const instance = container.getInstance(context, [])

      expect(instance.method1()).toBe('mocked1')
      expect(instance.method2()).toBe('original2')
    })
  })

  describe('Container Isolation', () => {
    it('should maintain separate registrations between containers', () => {
      const container1 = new Container()
      const container2 = new Container()

      class SharedClass {
        constructor(id) {
          this.id = id
        }
      }

      container1.registerSingleton(SharedClass)
      container2.registerSingleton(SharedClass)

      const context1 = container1.getContext(SharedClass)
      const context2 = container2.getContext(SharedClass)

      const instance1 = container1.getInstance(context1, ['container1'])
      const instance2 = container2.getInstance(context2, ['container2'])

      expect(instance1.id).toBe('container1')
      expect(instance2.id).toBe('container2')
      expect(instance1).not.toBe(instance2)
    })

    it('should isolate singletons between containers', () => {
      const container1 = new Container()
      const container2 = new Container()

      let callCount = 0
      class Counter {
        constructor() {
          this.count = ++callCount
        }
      }

      container1.registerSingleton(Counter)
      container2.registerSingleton(Counter)

      const context1 = container1.getContext(Counter)
      const context2 = container2.getContext(Counter)

      const instance1a = container1.getInstance(context1, [])
      const instance1b = container1.getInstance(context1, [])
      const instance2a = container2.getInstance(context2, [])
      const instance2b = container2.getInstance(context2, [])

      // Same container returns same singleton
      expect(instance1a).toBe(instance1b)
      expect(instance2a).toBe(instance2b)

      // Different containers have different singletons
      expect(instance1a).not.toBe(instance2a)
      expect(instance1a.count).toBe(1)
      expect(instance2a.count).toBe(2)
    })

    it('should isolate mocks between containers', () => {
      const container1 = new Container()
      const container2 = new Container()

      class Original {
        getValue() {
          return 'original'
        }
      }
      class MockClass {
        getValue() {
          return 'mocked'
        }
      }

      container1.registerSingleton(Original)
      container2.registerSingleton(Original)

      // Only mock in container1
      container1.registerMock(Original, MockClass)

      const context1 = container1.getContext(Original)
      const context2 = container2.getContext(Original)

      expect(container1.getInstance(context1, []).getValue()).toBe('mocked')
      expect(container2.getInstance(context2, []).getValue()).toBe('original')
    })

    it('should allow clearing one container without affecting another', () => {
      const container1 = new Container()
      const container2 = new Container()

      class MyClass {}

      container1.registerSingleton(MyClass, 'shared')
      container2.registerSingleton(MyClass, 'shared')

      container1.clear()

      expect(container1.has('shared')).toBe(false)
      expect(container2.has('shared')).toBe(true)
    })
  })

  describe('Clear Container', () => {
    it('should remove all registrations', () => {
      const container = new Container()

      class Class1 {}
      class Class2 {}

      container.registerSingleton(Class1)
      container.registerFactory(Class2, 'factory')

      expect(container.has(Class1)).toBe(true)
      expect(container.has('factory')).toBe(true)

      container.clear()

      expect(container.has(Class1)).toBe(false)
      expect(container.has('factory')).toBe(false)
    })

    it('should allow re-registration after clear', () => {
      const container = new Container()

      class MyClass {}

      container.registerSingleton(MyClass)
      container.clear()
      container.registerFactory(MyClass) // Different type - should work

      expect(container.has(MyClass)).toBe(true)
      const context = container.getContext(MyClass)
      expect(context.type).toBe('factory')
    })

    it('should reset singleton instances on clear', () => {
      const container = new Container()

      let callCount = 0
      class Counter {
        constructor() {
          this.count = ++callCount
        }
      }

      container.registerSingleton(Counter)

      const context1 = container.getContext(Counter)
      const instance1 = container.getInstance(context1, [])
      expect(instance1.count).toBe(1)

      container.clear()
      container.registerSingleton(Counter)

      const context2 = container.getContext(Counter)
      const instance2 = container.getInstance(context2, [])
      expect(instance2.count).toBe(2) // New instance created
    })
  })

  describe('Default Container (via index.js)', () => {
    afterEach(() => {
      clearContainer()
    })

    it('should expose the default container via getContainer()', () => {
      const container = getContainer()
      expect(container).toBeInstanceOf(Container)
    })

    it('should return the same container instance', () => {
      const container1 = getContainer()
      const container2 = getContainer()
      expect(container1).toBe(container2)
    })

    it('should clear the default container via clearContainer()', () => {
      const container = getContainer()

      class TestClass {}
      container.registerSingleton(TestClass, 'test')

      expect(container.has('test')).toBe(true)

      clearContainer()

      expect(container.has('test')).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    let container

    beforeEach(() => {
      container = new Container()
    })

    it('should handle string and class keys separately', () => {
      class MyClass {}

      container.registerSingleton(MyClass)
      container.registerFactory(MyClass, 'MyClass') // String name same as class name

      expect(container.has(MyClass)).toBe(true)
      expect(container.has('MyClass')).toBe(true)

      const classContext = container.getContext(MyClass)
      const stringContext = container.getContext('MyClass')

      expect(classContext.type).toBe('singleton')
      expect(stringContext.type).toBe('factory')
    })

    it('should handle empty constructor parameters', () => {
      class NoParams {
        constructor() {
          this.initialized = true
        }
      }

      container.registerFactory(NoParams)
      const context = container.getContext(NoParams)
      const instance = container.getInstance(context, [])

      expect(instance.initialized).toBe(true)
    })

    it('should preserve instance after mock reset', () => {
      class Original {}
      class MockClass {}

      container.registerSingleton(Original)

      // Create initial instance
      const context1 = container.getContext(Original)
      const originalInstance = container.getInstance(context1, [])

      // Mock and create mocked instance
      container.registerMock(Original, MockClass)
      const context2 = container.getContext(Original)
      const mockedInstance = container.getInstance(context2, [])

      expect(mockedInstance).toBeInstanceOf(MockClass)

      // Reset mock - should create new original instance
      container.resetMock(Original)
      const context3 = container.getContext(Original)
      const restoredInstance = container.getInstance(context3, [])

      expect(restoredInstance).toBeInstanceOf(Original)
      expect(restoredInstance).not.toBe(originalInstance) // New instance after mock/reset
    })

    it('should report has() correctly for unregistered items', () => {
      class Registered {}
      class NotRegistered {}

      container.registerSingleton(Registered)

      expect(container.has(Registered)).toBe(true)
      expect(container.has(NotRegistered)).toBe(false)
      expect(container.has('nonexistent')).toBe(false)
    })

    it('should throw when resetting mock for unregistered class', () => {
      class NotRegistered {}

      expect(() => container.resetMock(NotRegistered)).toThrow(
        'Cannot reset mock for "NotRegistered": not registered'
      )
    })

    it('should throw when resetting mock for unregistered name', () => {
      expect(() => container.resetMock('nonexistent')).toThrow(
        'Cannot reset mock for "nonexistent": not registered'
      )
    })
  })
})
