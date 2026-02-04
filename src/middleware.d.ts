import { Container, InjectionToken, ContainerKey } from '../../index'

export type ContainerScope = 'request' | 'global'

export function getGlobalContainer(): Container

/**
 * Get the container for the current request context.
 * If no request context is active, returns the global container.
 */
export function getContainer(): Container

export interface ResolveOptions {
  scope?: ContainerScope | object
  params?: any[]
}

export function resolve<T>(clazzOrName: InjectionToken<T>, options?: ResolveOptions): T

/**
 * Run a function with a specific container context.
 * @param keyOrContainer - Either a Container instance directly, or an object key for a container
 * @param fn - The function to run within the container context
 * @param options - Optional scope settings
 */
export function runWithContainer<T>(
  keyOrContainer: Container | object, 
  fn: () => T,
  options?: { scope?: ContainerScope }
): T

export interface MiddlewareOptions {
  scope?: ContainerScope
  debug?: boolean
}

export interface WithContainerOptions extends MiddlewareOptions {
  /**
   * Container key for reuse:
   * - Omitted: Creates a temporary container (not stored, auto-cleaned when function ends)
   * - String: Uses/creates a named container (persistent, must be manually destroyed)
   * - Object: Uses/creates an object-keyed container (auto-cleanup when object is GC'd)
   */
  key?: ContainerKey
}

export interface ContainerRequest {
  di: Container
}

export function containerMiddleware(
  options?: MiddlewareOptions
): (req: any, res: any, next: () => void) => void

export function koaContainerMiddleware(
  options?: MiddlewareOptions
): (ctx: any, next: () => Promise<void>) => Promise<void>

/**
 * Wrap a handler function with a container context.
 * 
 * @example
 * // Temporary isolated container (cleaned up when handler completes)
 * const handler = withContainer()(async (req, res) => {
 *   const user = resolve(UserService)
 * })
 * 
 * @example
 * // Reuse a named container across handlers
 * const handler = withContainer({ key: 'worker-pool' })(async () => {
 *   const worker = resolve(WorkerService)
 * })
 */
export function withContainer<T extends (...args: any[]) => any>(
  options?: WithContainerOptions
): (handler: T) => T
): (handler: T) => T
