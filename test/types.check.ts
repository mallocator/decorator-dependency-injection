// Type verification file - this file is used to verify TypeScript definitions
// Run with: npx tsc --noEmit test/types.check.ts

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
  isRegistered,
  validateRegistrations,
  setDebug,
  InstanceContext,
  FieldOrAccessorDecorator,
  Constructor,
  InjectionToken
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

// Test Inject types - now returns FieldOrAccessorDecorator for TC39 Stage 3 decorators
class SomeClass {}
const injectDecorator: FieldOrAccessorDecorator = Inject(SomeClass)
const injectWithName: FieldOrAccessorDecorator = Inject('someName')
const injectWithParams: FieldOrAccessorDecorator = Inject(SomeClass, 'param1', 42)

// Test InjectLazy types - now returns FieldOrAccessorDecorator for TC39 Stage 3 decorators
const lazyDecorator: FieldOrAccessorDecorator = InjectLazy(SomeClass)
const lazyWithName: FieldOrAccessorDecorator = InjectLazy('someName')
const lazyWithParams: FieldOrAccessorDecorator = InjectLazy(SomeClass, 'param1', 42)

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

// Test isRegistered types
const isReg1: boolean = isRegistered(SomeClass)
const isReg2: boolean = isRegistered('someName')

// Test validateRegistrations types
validateRegistrations(SomeClass)
validateRegistrations('someName')
validateRegistrations(SomeClass, 'someName')

// Test setDebug types
setDebug(true)
setDebug(false)
container.setDebug(true)

// Test new type aliases
const ctor: Constructor<SomeClass> = SomeClass
const token1: InjectionToken<SomeClass> = SomeClass
const token2: InjectionToken = 'namedToken'

// Test InstanceContext interface
const ctx: InstanceContext = {
  type: 'singleton',
  clazz: SomeClass,
  originalClazz: undefined,
  instance: undefined,
  proxy: false
}

console.log('All type checks passed!')
