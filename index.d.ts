/**
 * Type definitions for decorator-dependency-injection
 */

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
   * Register a class as a singleton.
   */
  registerSingleton(clazz: new (...args: any[]) => any, name?: string): void

  /**
   * Register a class as a factory.
   */
  registerFactory(clazz: new (...args: any[]) => any, name?: string): void

  /**
   * Get the context for a given class or name.
   */
  getContext(clazzOrName: string | (new (...args: any[]) => any)): InstanceContext

  /**
   * Check if a class or name is registered.
   */
  has(clazzOrName: string | (new (...args: any[]) => any)): boolean

  /**
   * Get or create an instance based on the context.
   */
  getInstance(instanceContext: InstanceContext, params: any[]): any

  /**
   * Register a mock for an existing class.
   */
  registerMock(
    targetClazzOrName: string | (new (...args: any[]) => any),
    mockClazz: new (...args: any[]) => any,
    useProxy?: boolean
  ): void

  /**
   * Reset a specific mock to its original class.
   */
  resetMock(clazzOrName: string | (new (...args: any[]) => any)): void

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
 * Inject a singleton or factory instance into a class field.
 * @param clazzOrName The class or name to inject
 * @param params Optional parameters to pass to the constructor
 */
export declare function Inject<T>(
  clazzOrName: string | (new (...args: any[]) => T),
  ...params: any[]
): PropertyDecorator

/**
 * Inject a singleton or factory instance lazily into a class field.
 * The instance is created on first access.
 * @param clazzOrName The class or name to inject
 * @param params Optional parameters to pass to the constructor
 */
export declare function InjectLazy<T>(
  clazzOrName: string | (new (...args: any[]) => T),
  ...params: any[]
): PropertyDecorator

/**
 * Mark a class as a mock for another class.
 * @param mockedClazzOrName The class or name to mock
 * @param proxy If true, unmocked methods delegate to the original
 */
export declare function Mock(
  mockedClazzOrName: string | (new (...args: any[]) => any),
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
export declare function resetMock(clazzOrName: string | (new (...args: any[]) => any)): void

/**
 * Clear all registered instances and mocks from the container.
 */
export declare function clearContainer(): void

/**
 * Get the default container instance.
 */
export declare function getContainer(): Container

/**
 * Create a proxy that delegates to the mock first, then falls back to the original.
 * This is an internal utility but exported for advanced use cases.
 *
 * @param mock The mock instance
 * @param original The original instance to fall back to
 */
export declare function createProxy<T extends object>(mock: T, original: T): T
