export type Constructor<T = any> = new (...args: any[]) => T
export type InjectionToken<T = any> = string | Constructor<T>

/** Key type for container lookup - can be a string name or an object (e.g., request object) */
export type ContainerKey = string | object

export interface ScopeOptions {
  /** Named container/scope to use - can be a string name or an object key */
  scope?: ContainerKey
}

export interface ResetOptions extends ScopeOptions {
  preserveMocks?: boolean
}

export interface ClearOptions extends ScopeOptions {
  preserveRegistrations?: boolean
}

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
  /** The parent container (if any) for auto-registration inheritance */
  readonly parent: Container | null
  setDebug(enabled: boolean): void
  registerSingleton<T>(clazz: Constructor<T>, name?: string): void
  registerFactory<T>(clazz: Constructor<T>, name?: string): void
  getContext<T>(clazzOrName: InjectionToken<T>): InstanceContext
  has<T>(clazzOrName: InjectionToken<T>, checkParent?: boolean): boolean
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

export declare function removeAllMocks(options?: ScopeOptions): void
export declare function removeMock<T>(clazzOrName: InjectionToken<T>, options?: ScopeOptions): void
export declare function resetSingletons(options?: ResetOptions): void
export declare function clearContainer(options?: ClearOptions): void
/**
 * Get a container by key. If no key is provided, returns the default container.
 * - String keys: containers stored in a Map (must be explicitly destroyed)
 * - Object keys: containers stored in a WeakMap (auto garbage-collected)
 * @param key - Optional container key (string or object)
 */
export declare function getContainer(key?: ContainerKey): Container
/**
 * Check if a container exists for the given key.
 * Note: For object keys, this only returns true if the container was explicitly created.
 */
export declare function hasContainer(key: ContainerKey): boolean
/**
 * Destroy a container by its key.
 * @returns true if the container existed and was destroyed, false otherwise
 */
export declare function destroyContainer(key: ContainerKey): boolean
/**
 * List all string-keyed containers.
 * Note: Object-keyed containers cannot be listed (WeakMap has no enumeration).
 */
export declare function listContainers(): string[]
export declare function setDebug(enabled: boolean, options?: ScopeOptions): void
export declare function isRegistered<T>(clazzOrName: InjectionToken<T>, options?: ScopeOptions): boolean
export declare function isMocked<T>(clazzOrName: InjectionToken<T>, options?: ScopeOptions): boolean
export declare function getMockInstance<T>(clazzOrName: InjectionToken<T>, ...paramsOrOptions: [...any[], ScopeOptions] | any[]): T
export declare function unregister<T>(clazzOrName: InjectionToken<T>, options?: ScopeOptions): boolean
export declare function listRegistrations(options?: ScopeOptions): RegistrationInfo[]
export declare function validateRegistrations(...tokens: InjectionToken[]): void
export declare function validateRegistrations(...tokensWithOptions: [...InjectionToken[], ScopeOptions]): void
export declare function resolve<T>(clazzOrName: InjectionToken<T>, ...paramsOrOptions: [...any[], ScopeOptions] | any[]): T
export declare function createProxy<T extends object>(mock: T, original: T): T
export declare const defaultContainer: Container
