// Type verification file - this file is used to verify TypeScript definitions
// Run with: npx tsc --noEmit test/types.test.ts

import {
  Container,
  Singleton,
  Factory,
  Inject,
  InjectLazy,
  Mock,
  resetMocks,
  resetMock,
  clearContainer,
  getContainer,
  createProxy,
  InstanceContext
} from '../index'

// Test Container class types
const container: Container = new Container()
container.registerSingleton(class TestClass {}, 'testName')
container.registerFactory(class TestFactory {})
const hasIt: boolean = container.has('testName')
const context: InstanceContext = container.getContext('testName')
const instance: any = container.getInstance(context, ['param1', 'param2'])
container.registerMock('testName', class MockClass {}, true)
container.resetMock('testName')
container.resetAllMocks()
container.clear()

// Test decorator types
const singletonDecorator: ClassDecorator = Singleton()
const namedSingletonDecorator: ClassDecorator = Singleton('named')
const factoryDecorator: ClassDecorator = Factory()
const namedFactoryDecorator: ClassDecorator = Factory('named')

// Test Inject types
class SomeClass {}
const injectDecorator: PropertyDecorator = Inject(SomeClass)
const injectWithName: PropertyDecorator = Inject('someName')
const injectWithParams: PropertyDecorator = Inject(SomeClass, 'param1', 42)

// Test InjectLazy types
const lazyDecorator: PropertyDecorator = InjectLazy(SomeClass)
const lazyWithName: PropertyDecorator = InjectLazy('someName')
const lazyWithParams: PropertyDecorator = InjectLazy(SomeClass, 'param1', 42)

// Test Mock types
const mockDecorator: ClassDecorator = Mock(SomeClass)
const mockWithProxy: ClassDecorator = Mock(SomeClass, true)
const mockWithName: ClassDecorator = Mock('someName', false)

// Test utility function types
resetMocks()
resetMock(SomeClass)
resetMock('someName')
clearContainer()
const defaultContainer: Container = getContainer()

// Test createProxy types
const mockObj = { foo: 'bar' }
const originalObj = { foo: 'original', baz: 'value' }
const proxied: typeof mockObj = createProxy(mockObj, originalObj)

// Test InstanceContext interface
const ctx: InstanceContext = {
  type: 'singleton',
  clazz: SomeClass,
  originalClazz: undefined,
  instance: undefined,
  proxy: false
}

console.log('All type checks passed!')
