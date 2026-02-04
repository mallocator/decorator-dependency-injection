import { Container, InjectionToken } from '../../index'

export type ContainerScope = 'request' | 'global'

export function getGlobalContainer(): Container
export function getContainer(): Container

export interface ResolveOptions {
  scope?: ContainerScope
  params?: any[]
}

export function resolve<T>(clazzOrName: InjectionToken<T>, options?: ResolveOptions): T

export function runWithContainer<T>(
  container: Container, 
  fn: () => T,
  options?: { scope?: ContainerScope }
): T

export interface MiddlewareOptions {
  scope?: ContainerScope
  debug?: boolean
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

export function withContainer<T extends (...args: any[]) => any>(
  options?: MiddlewareOptions
): (handler: T) => T
