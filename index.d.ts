/**
 * Type definitions for decorator-dependency-injection
 */

/**
 * A class constructor type.
 * @template T The instance type
 */
export type Constructor<T = any> = new (...args: any[]) => T

/**
 * Valid injection target: either a class constructor or a string name.
 */
export type InjectionToken<T = any> = string | Constructor<T>

/**
 * Context for registered instances in the container
 */
export interface InstanceContext {
  /** The type of registration */
  type: 'singleton' | 'factory'
  /** The current class constructor (may be a mock) */
  clazz: new (...args: any[]) => any
  /** The original class constructor if mocked */
  originalClazz?: new (...args: any[]) => any
  /** The cached singleton instance */
  instance?: any
  /** Whether to use proxy mocking */
  proxy?: boolean
}

/**
 * Registration info returned by list()
 */
export interface RegistrationInfo {
  /** The registration key (class or string name) */
  key: string | Constructor
  /** Human-readable name */
  name: string
  /** Registration type */
  type: 'singleton' | 'factory'
  /** Whether this registration is mocked */
  isMocked: boolean
  /** Whether a cached instance exists */
  hasInstance: boolean
}

/**
 * A dependency injection container that manages singleton and factory instances.
 */
export declare class Container {
  /**
   * Custom string tag for better debugging.
   * Shows as [object Container] in console.
   */
  readonly [Symbol.toStringTag]: 'Container'

  /**
   * Make the container iterable.
   * Yields registration info for each registered class.
   */
  [Symbol.iterator](): IterableIterator<RegistrationInfo>

  /**
   * Get the number of registrations in the container.
   */
  readonly size: number

  /**
   * Enable or disable debug logging.
   * When enabled, logs when instances are created.
   */
  setDebug(enabled: boolean): void

  /**
   * Register a class as a singleton.
   */
  registerSingleton<T>(clazz: Constructor<T>, name?: string): void

  /**
   * Register a class as a factory.
   */
  registerFactory<T>(clazz: Constructor<T>, name?: string): void

  /**
   * Get the context for a given class or name.
   * @throws Error if the class/name is not registered
   */
  getContext<T>(clazzOrName: InjectionToken<T>): InstanceContext

  /**
   * Check if a class or name is registered.
   */
  has<T>(clazzOrName: InjectionToken<T>): boolean

  /**
   * Check if a class or name has a mock registered.
   */
  isMocked<T>(clazzOrName: InjectionToken<T>): boolean

  /**
   * Unregister a class or name from the container.
   * @returns true if the registration was removed, false if it wasn't registered
   */
  unregister<T>(clazzOrName: InjectionToken<T>): boolean

  /**
   * List all registrations in the container.
   */
  list(): RegistrationInfo[]

  /**
   * Resolve and return an instance by class or name.
   * This allows non-decorator code to retrieve instances from the container.
   */
  resolve<T>(clazzOrName: InjectionToken<T>, ...params: any[]): T

  /**
   * Get or create an instance based on the context.
   */
  getInstance<T>(instanceContext: InstanceContext, params: any[]): T

  /**
   * Register a mock for an existing class.
   */
  registerMock<T>(targetClazzOrName: InjectionToken<T>, mockClazz: Constructor<Partial<T>>, useProxy?: boolean): void

  /**
   * Get the mock instance for a mocked class.
   * @throws Error if the class is not mocked
   */
  getMockInstance<T>(clazzOrName: InjectionToken<T>, ...params: any[]): T

  /**
   * Remove a specific mock and restore the original class.
   * This completely removes the mock - it does NOT clear mock call history.
   */
  removeMock<T>(clazzOrName: InjectionToken<T>): void

  /**
   * Remove all mocks and restore original classes.
   * This completely removes all mocks - it does NOT clear mock call history.
   */
  removeAllMocks(): void

  /**
   * @deprecated Use removeMock() instead. This will be removed in a future version.
   * WARNING: This removes the mock, it does NOT clear mock call history.
   */
  resetMock<T>(clazzOrName: InjectionToken<T>): void

  /**
   * @deprecated Use removeAllMocks() instead. This will be removed in a future version.
   * WARNING: This removes all mocks, it does NOT clear mock call history.
   */
  resetAllMocks(): void

  /**
   * Reset singleton instances without removing registrations.
   * Mock registrations are preserved by default.
   */
  resetSingletons(options?: { preserveMocks?: boolean }): void

  /**
   * Clear all registered instances and mocks.
   * @param options.preserveRegistrations If true, keeps all registrations but clears cached instances.
   */
  clear(options?: { preserveRegistrations?: boolean }): void
}

/**
 * Register a class as a singleton.
 * @param name Optional name to register the singleton under
 */
export declare function Singleton(name?: string): ClassDecorator

/**
 * Register a class as a factory.
 * @param name Optional name to register the factory under
 */
export declare function Factory(name?: string): ClassDecorator

/**
 * Decorator return type that works for both fields and accessors.
 * For fields, returns a function that provides the initial value.
 * For accessors, returns an object with get/set/init.
 */
export type FieldOrAccessorDecorator = (
  target: undefined,
  context: ClassFieldDecoratorContext | ClassAccessorDecoratorContext
) => void | ((initialValue: any) => any) | ClassAccessorDecoratorResult<any, any>

/**
 * Inject a singleton or factory instance into a class field or accessor.
 * 
 * Supports:
 * - Public fields: `@Inject(MyClass) myField`
 * - Private fields: `@Inject(MyClass) #myField`
 * - Public accessors: `@Inject(MyClass) accessor myField`
 * - Private accessors: `@Inject(MyClass) accessor #myField`
 * 
 * @param clazzOrName The class or name to inject
 * @param params Optional parameters to pass to the constructor
 * 
 * @example
 * class MyService {
 *   @Inject(Database) db
 *   @Inject(Logger) #logger  // private field
 *   @Inject(Cache) accessor cache  // accessor (recommended for lazy-like behavior)
 * }
 */
export declare function Inject<T>(
  clazzOrName: InjectionToken<T>,
  ...params: any[]
): FieldOrAccessorDecorator

/**
 * Inject a singleton or factory instance lazily into a class field or accessor.
 * The instance is created on first access.
 * 
 * Supports:
 * - Public fields: `@InjectLazy(MyClass) myField` (true lazy)
 * - Private fields: `@InjectLazy(MyClass) #myField` (not truly lazy - use accessor instead)
 * - Public accessors: `@InjectLazy(MyClass) accessor myField` (true lazy)
 * - Private accessors: `@InjectLazy(MyClass) accessor #myField` (true lazy, recommended)
 * 
 * Note: For true lazy injection with private members, use the accessor syntax:
 * `@InjectLazy(MyClass) accessor #myField`
 * 
 * @param clazzOrName The class or name to inject
 * @param params Optional parameters to pass to the constructor
 * 
 * @example
 * class MyService {
 *   @InjectLazy(ExpensiveService) accessor #expensiveService
 * }
 */
export declare function InjectLazy<T>(
  clazzOrName: InjectionToken<T>,
  ...params: any[]
): FieldOrAccessorDecorator

/**
 * Mark a class as a mock for another class.
 * The mock class can implement only the methods you need (Partial<T>).
 * 
 * @param mockedClazzOrName The class or name to mock
 * @param proxy If true, unmocked methods delegate to the original implementation
 * 
 * @example Basic mocking
 * ```ts
 * @Mock(UserService)
 * class MockUserService {
 *   // Only implement methods you need to mock
 *   getUser() { return { id: 1, name: 'Test' } }
 * }
 * ```
 * 
 * @example With hoisted mock functions (Vitest/Jest)
 * ```ts
 * const mockGetUser = vi.hoisted(() => vi.fn())
 * 
 * @Mock(UserService)
 * class MockUserService {
 *   getUser = mockGetUser
 * }
 * 
 * beforeEach(() => {
 *   mockGetUser.mockClear() // Clear call history, not removeMock()
 * })
 * ```
 */
export declare function Mock<T>(
  mockedClazzOrName: InjectionToken<T>,
  proxy?: boolean
): ClassDecorator

/**
 * Remove all mocks and restore original classes.
 * This completely removes all mocks - it does NOT clear mock call history.
 */
export declare function removeAllMocks(): void

/**
 * Remove a specific mock and restore the original class.
 * This completely removes the mock - it does NOT clear mock call history.
 * @param clazzOrName The class or name to restore
 */
export declare function removeMock<T>(clazzOrName: InjectionToken<T>): void

/**
 * @deprecated Use removeAllMocks() instead. This will be removed in a future version.
 * WARNING: This removes all mocks, it does NOT clear mock call history.
 */
export declare function resetMocks(): void

/**
 * @deprecated Use removeMock() instead. This will be removed in a future version.
 * WARNING: This removes the mock, it does NOT clear mock call history.
 * @param clazzOrName The class or name to restore
 */
export declare function resetMock<T>(clazzOrName: InjectionToken<T>): void

/**
 * Reset singleton instances without removing registrations.
 * Mock registrations are preserved by default.
 * 
 * Ideal for test isolation where you want fresh instances but keep mocks.
 * 
 * @param options.preserveMocks If true (default), keeps mock registrations
 */
export declare function resetSingletons(options?: { preserveMocks?: boolean }): void

/**
 * Clear all registered instances and mocks from the container.
 * @param options.preserveRegistrations If true, keeps all registrations but clears cached instances.
 */
export declare function clearContainer(options?: { preserveRegistrations?: boolean }): void

/**
 * Get the default container instance.
 */
export declare function getContainer(): Container

/**
 * Enable or disable debug logging for dependency injection.
 * When enabled, logs when instances are registered, created, and mocked.
 * @param enabled Whether to enable debug mode
 */
export declare function setDebug(enabled: boolean): void

/**
 * Check if a class or name is registered in the default container.
 * Useful for validation before injection.
 * @param clazzOrName The class or name to check
 * @returns true if registered, false otherwise
 */
export declare function isRegistered<T>(clazzOrName: InjectionToken<T>): boolean

/**
 * Check if a class or name has a mock registered.
 * @param clazzOrName The class or name to check
 * @returns true if mocked, false otherwise
 */
export declare function isMocked<T>(clazzOrName: InjectionToken<T>): boolean

/**
 * Get the mock instance for a mocked class.
 * Useful for configuring mock behavior dynamically in tests.
 * 
 * @param clazzOrName The original class or name that was mocked
 * @param params Parameters to pass to the constructor
 * @returns The mock instance
 * @throws Error if the class is not mocked
 * 
 * @example
 * ```ts
 * const mock = getMockInstance(UserService)
 * mock.getUser.mockReturnValue({ id: 1 })
 * ```
 */
export declare function getMockInstance<T>(clazzOrName: InjectionToken<T>, ...params: any[]): T

/**
 * Unregister a class or name from the container.
 * @param clazzOrName The class or name to unregister
 * @returns true if the registration was removed, false if it wasn't registered
 */
export declare function unregister<T>(clazzOrName: InjectionToken<T>): boolean

/**
 * List all registrations in the container.
 * Useful for debugging and introspection.
 */
export declare function listRegistrations(): RegistrationInfo[]

/**
 * Validate that all provided injection tokens are registered.
 * Throws an error with details about missing registrations.
 * Useful for fail-fast validation at application startup.
 * @param tokens Array of classes or names to validate
 * @throws Error if any token is not registered
 */
export declare function validateRegistrations<T extends InjectionToken[]>(...tokens: T): void

/**
 * Resolve and return an instance by class or name.
 * This allows non-decorator code (plain functions, modules, etc.) to retrieve
 * instances from the DI container.
 *
 * @param clazzOrName The class or name to resolve
 * @param params Optional parameters to pass to the constructor
 * @returns The resolved instance
 * @throws Error if the class or name is not registered
 *
 * @example
 * // In a plain function:
 * function handleRequest(req: Request) {
 *   const userService = resolve(UserService)
 *   return userService.getUser(req.userId)
 * }
 *
 * @example
 * // With a named registration:
 * const db = resolve<Database>('database')
 */
export declare function resolve<T>(clazzOrName: InjectionToken<T>, ...params: any[]): T

/**
 * Create a proxy that delegates to the mock first, then falls back to the original.
 * This is an internal utility but exported for advanced use cases.
 *
 * @param mock The mock instance
 * @param original The original instance to fall back to
 */
export declare function createProxy<T extends object>(mock: T, original: T): T
