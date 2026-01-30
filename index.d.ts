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
 * A dependency injection container that manages singleton and factory instances.
 */
export declare class Container {
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
   * Get or create an instance based on the context.
   */
  getInstance<T>(instanceContext: InstanceContext, params: any[]): T

  /**
   * Register a mock for an existing class.
   */
  registerMock<T>(
    targetClazzOrName: InjectionToken<T>,
    mockClazz: Constructor<T>,
    useProxy?: boolean
  ): void

  /**
   * Reset a specific mock to its original class.
   */
  resetMock<T>(clazzOrName: InjectionToken<T>): void

  /**
   * Reset all mocks to their original classes.
   */
  resetAllMocks(): void

  /**
   * Clear all registered instances and mocks.
   */
  clear(): void
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
 * @param mockedClazzOrName The class or name to mock
 * @param proxy If true, unmocked methods delegate to the original
 */
export declare function Mock<T>(
  mockedClazzOrName: InjectionToken<T>,
  proxy?: boolean
): ClassDecorator

/**
 * Reset all mocks to their original classes.
 */
export declare function resetMocks(): void

/**
 * Reset a specific mock to its original class.
 * @param clazzOrName The class or name to reset
 */
export declare function resetMock<T>(clazzOrName: InjectionToken<T>): void

/**
 * Clear all registered instances and mocks from the container.
 */
export declare function clearContainer(): void

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
 * Validate that all provided injection tokens are registered.
 * Throws an error with details about missing registrations.
 * Useful for fail-fast validation at application startup.
 * @param tokens Array of classes or names to validate
 * @throws Error if any token is not registered
 */
export declare function validateRegistrations<T extends InjectionToken[]>(...tokens: T): void

/**
 * Create a proxy that delegates to the mock first, then falls back to the original.
 * This is an internal utility but exported for advanced use cases.
 *
 * @param mock The mock instance
 * @param original The original instance to fall back to
 */
export declare function createProxy<T extends object>(mock: T, original: T): T
