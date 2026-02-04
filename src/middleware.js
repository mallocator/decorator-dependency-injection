/**
 * Server middleware integration for decorator-dependency-injection.
 * 
 * Provides request-scoped containers using request objects as container keys.
 * This enables automatic per-request isolation without manual container management.
 * 
 * Object-keyed containers are stored in a WeakMap, so they're automatically
 * garbage collected when the request object is no longer referenced.
 * 
 * @module decorator-dependency-injection/middleware
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { Container } from './Container.js'
import { getContainer as getContainerByKey, defaultContainer } from '../index.js'

/** 
 * AsyncLocalStorage to track the current request context.
 * @type {AsyncLocalStorage<{key?: object, container?: Container, scope: string}>} 
 */
const requestContext = new AsyncLocalStorage()

/** @returns {Container} */
export function getGlobalContainer() {
  return defaultContainer
}

/** 
 * Get the current request's container, or the global container if outside a request.
 * @returns {Container} 
 */
export function getContainer() {
  const ctx = requestContext.getStore()
  if (!ctx) return defaultContainer
  return ctx.container || getContainerByKey(ctx.key)
}

/**
 * Request-aware resolve. Uses request-scoped container inside requests,
 * falls back to global container outside.
 * 
 * @template T
 * @param {string|Function} clazzOrName
 * @param {Object} [options]
 * @param {'request'|'global'|object} [options.scope] - 'global', 'request', or an object key
 * @param {Array} [options.params]
 * @returns {T}
 */
export function resolve(clazzOrName, options = {}) {
  const { scope, params = [] } = options
  
  // Explicit scope (global, object key, or request) - use getContainerByKey
  if (scope === 'global') {
    return defaultContainer.resolve(clazzOrName, ...params)
  }
  if (scope && typeof scope === 'object') {
    return getContainerByKey(scope).resolve(clazzOrName, ...params)
  }
  
  // Use current context's container (falls back to global)
  return getContainer().resolve(clazzOrName, ...params)
}

/**
 * Run a function with a specific container context.
 * @template T
 * @param {object|Container} keyOrContainer - The container key (object) or a Container instance
 * @param {function(): T} fn
 * @param {Object} [options]
 * @param {'request'|'global'} [options.scope='request']
 * @returns {T}
 */
export function runWithContainer(keyOrContainer, fn, options = {}) {
  const { scope = 'request' } = options
  
  // If a Container is passed directly, use it; otherwise lookup by key
  if (keyOrContainer instanceof Container) {
    return requestContext.run({ container: keyOrContainer, scope }, fn)
  }
  return requestContext.run({ key: keyOrContainer, scope }, fn)
}

/**
 * @typedef {Object} MiddlewareOptions
 * @property {'request'|'global'} [scope='request'] - Container scope mode:
 *   - 'request': Each request gets its own container (default, SSR-safe)
 *   - 'global': All requests share the global container
 * @property {boolean} [debug=false] - Enable debug logging
 */

/**
 * Express/Connect middleware.
 * 
 * Uses the request object itself as the container key, meaning:
 * - Any code with access to `req` can get the same container via `getContainer(req)`
 * - You can pass `req` to nested functions: `resolve(Service, { scope: req })`
 * - You can use `withContainer({ key: req })` to share the request's container
 * 
 * @example
 * app.use(containerMiddleware())
 * app.get('/api', (req, res) => {
 *   // All these access the SAME container:
 *   const a = req.di.resolve(UserService)
 *   const b = resolve(UserService)  // via AsyncLocalStorage
 *   const c = resolve(UserService, { scope: req })  // explicit
 *   const d = getContainer(req).resolve(UserService)  // from index.js
 * })
 * 
 * @param {MiddlewareOptions} [options={}]
 * @returns {function(req, res, next): void}
 */
export function containerMiddleware(options = {}) {
  const { scope = 'request', debug = false } = options

  return (req, res, next) => {
    if (scope === 'global') {
      req.di = defaultContainer
      return requestContext.run({ scope: 'global' }, () => next())
    }

    const container = getContainerByKey(req)
    if (debug) container.setDebug(true)
    req.di = container
    requestContext.run({ key: req, scope: 'request' }, () => next())
  }
}

/**
 * Koa middleware.
 * 
 * Uses the Koa context object (`ctx`) as the container key, meaning:
 * - Any code with access to `ctx` can get the same container via `getContainer(ctx)`
 * - You can pass `ctx` to nested functions: `resolve(Service, { scope: ctx })`
 * 
 * @param {MiddlewareOptions} [options={}]
 * @returns {function(ctx, next): Promise<void>}
 */
export function koaContainerMiddleware(options = {}) {
  const { scope = 'request', debug = false } = options

  return async (ctx, next) => {
    if (scope === 'global') {
      ctx.di = defaultContainer
      return requestContext.run({ scope: 'global' }, () => next())
    }

    const container = getContainerByKey(ctx)
    if (debug) container.setDebug(true)
    ctx.di = container
    await requestContext.run({ key: ctx, scope: 'request' }, () => next())
  }
}

/**
 * @typedef {Object} WithContainerOptions
 * @property {string|object} [key] - Container key for reuse:
 *   - Omitted: Creates a temporary container (not stored, auto-cleaned when function ends)
 *   - String: Uses/creates a named container (persistent, must be manually destroyed)
 *   - Object: Uses/creates an object-keyed container (auto-cleanup when object is GC'd)
 * @property {'request'|'global'} [scope='request'] - Container scope mode
 * @property {boolean} [debug=false] - Enable debug logging
 */

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
 * 
 * @example
 * // Use request object as key (shares with other handlers using same key)
 * const handler = withContainer({ key: req })(async () => {
 *   const user = resolve(UserService)
 * })
 * 
 * @param {WithContainerOptions} [options={}]
 * @returns {function(handler): function}
 */
export function withContainer(options = {}) {
  const { scope = 'request', debug = false, key } = options

  return (handler) => (...args) => {
    if (scope === 'global') {
      return requestContext.run({ scope: 'global' }, () => handler(...args))
    }

    // If key provided, use the registry (container persists based on key type)
    if (key != null) {
      const container = getContainerByKey(key)
      if (debug) container.setDebug(true)
      return requestContext.run({ key, scope: 'request' }, () => handler(...args))
    }

    // No key = temporary container (not stored, GC'd when function completes)
    const tempContainer = new Container(defaultContainer)
    if (debug) tempContainer.setDebug(true)
    return requestContext.run({ container: tempContainer, scope: 'request' }, () => handler(...args))
  }
}
