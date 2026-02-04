export type Constructor<T = any> = new (...args: any[]) => T
export type InjectionToken<T = any> = string | Constructor<T>

export interface InstanceContext {
  type: 'singleton' | 'factory'
  clazz: new (...args: any[]) => any
  originalClazz?: new (...args: any[]) => any
  instance?: any
  proxy?: boolean
}

export interface RegistrationInfo {
  key: string | Constructor
  name: string
  type: 'singleton' | 'factory'
  isMocked: boolean
  hasInstance: boolean
}

export declare class Container {
  readonly [Symbol.toStringTag]: 'Container'
  [Symbol.iterator](): IterableIterator<RegistrationInfo>
  readonly size: number
  setDebug(enabled: boolean): void
  registerSingleton<T>(clazz: Constructor<T>, name?: string): void
  registerFactory<T>(clazz: Constructor<T>, name?: string): void
  getContext<T>(clazzOrName: InjectionToken<T>): InstanceContext
  has<T>(clazzOrName: InjectionToken<T>): boolean
  isMocked<T>(clazzOrName: InjectionToken<T>): boolean
  unregister<T>(clazzOrName: InjectionToken<T>): boolean
  list(): RegistrationInfo[]
  resolve<T>(clazzOrName: InjectionToken<T>, ...params: any[]): T
  getInstance<T>(instanceContext: InstanceContext, params: any[]): T
  registerMock<T>(targetClazzOrName: InjectionToken<T>, mockClazz: Constructor<Partial<T>>, useProxy?: boolean): void
  getMockInstance<T>(clazzOrName: InjectionToken<T>, ...params: any[]): T
  removeMock<T>(clazzOrName: InjectionToken<T>): void
  removeAllMocks(): void
  resetSingletons(options?: { preserveMocks?: boolean }): void
  clear(options?: { preserveRegistrations?: boolean }): void
}

export type FieldOrAccessorDecorator = (
  target: undefined,
  context: ClassFieldDecoratorContext | ClassAccessorDecoratorContext
) => void | ((initialValue: any) => any) | ClassAccessorDecoratorResult<any, any>

export declare function Singleton(name?: string): ClassDecorator
export declare function Factory(name?: string): ClassDecorator
export declare function Inject<T>(clazzOrName: InjectionToken<T>, ...params: any[]): FieldOrAccessorDecorator
export declare function InjectLazy<T>(clazzOrName: InjectionToken<T>, ...params: any[]): FieldOrAccessorDecorator
export declare function Mock<T>(mockedClazzOrName: InjectionToken<T>, proxy?: boolean): ClassDecorator

export declare function removeAllMocks(): void
export declare function removeMock<T>(clazzOrName: InjectionToken<T>): void
export declare function resetSingletons(options?: { preserveMocks?: boolean }): void
export declare function clearContainer(options?: { preserveRegistrations?: boolean }): void
export declare function getContainer(): Container
export declare function setDebug(enabled: boolean): void
export declare function isRegistered<T>(clazzOrName: InjectionToken<T>): boolean
export declare function isMocked<T>(clazzOrName: InjectionToken<T>): boolean
export declare function getMockInstance<T>(clazzOrName: InjectionToken<T>, ...params: any[]): T
export declare function unregister<T>(clazzOrName: InjectionToken<T>): boolean
export declare function listRegistrations(): RegistrationInfo[]
export declare function validateRegistrations<T extends InjectionToken[]>(...tokens: T): void
export declare function resolve<T>(clazzOrName: InjectionToken<T>, ...params: any[]): T
export declare function createProxy<T extends object>(mock: T, original: T): T
export declare const defaultContainer: Container
