/**
 * Server middleware integration for decorator-dependency-injection.
 * 
 * Provides request-scoped containers using AsyncLocalStorage, enabling
 * automatic per-request isolation without manual container management.
 * 
 * IMPORTANT: When using this module, `resolve()` behaves differently than 
 * the main module's resolve:
 * - Inside a request: Returns instances from the request-scoped container
 *   (singletons are isolated per-request, preventing data leaks between users)
 * - Outside a request: Falls back to the global container
 * 
 * @module decorator-dependency-injection/middleware
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { Container } from '../Container.js'
import { defaultContainer as mainDefaultContainer } from '../../index.js'

/** @type {AsyncLocalStorage<{container: Container, scope: string}>} */
const requestContext = new AsyncLocalStorage()

/** @type {Container} */
const globalContainer = mainDefaultContainer

/** @returns {Container|null} */
export function getGlobalContainer() {
  return globalContainer
}

function getRequestContext() {
  return requestContext.getStore()
}

/** @returns {Container} */
export function getContainer() {
  return getRequestContext()?.container ?? globalContainer
}

/**
 * Request-aware resolve. Uses request-scoped container inside requests,
 * falls back to global container outside. Auto-registers from global container.
 * 
 * @template T
 * @param {string|Function} clazzOrName
 * @param {Object} [options]
 * @param {'request'|'global'} [options.scope]
 * @param {Array} [options.params]
 * @returns {T}
 */
export function resolve(clazzOrName, options = {}) {
  const { scope, params = [] } = options
  const ctx = getRequestContext()
  
  if (scope === 'global' || ctx?.scope === 'global') {
    return globalContainer.resolve(clazzOrName, ...params)
  }
  
  if (!ctx) {
    if (scope === 'request') {
      console.warn(
        `[DI] resolve() called with scope='request' but no request context exists. ` +
        `Did you forget to use containerMiddleware()? Falling back to global container.`
      )
    }
    return globalContainer.resolve(clazzOrName, ...params)
  }
  
  const requestContainer = ctx.container
  
  if (!requestContainer.has(clazzOrName) && globalContainer?.has(clazzOrName)) {
    const globalContext = globalContainer.getContext(clazzOrName)
    if (globalContext.type === 'singleton') {
      requestContainer.registerSingleton(globalContext.clazz, 
        typeof clazzOrName === 'string' ? clazzOrName : undefined)
    } else {
      requestContainer.registerFactory(globalContext.clazz,
        typeof clazzOrName === 'string' ? clazzOrName : undefined)
    }
  }
  
  return requestContainer.resolve(clazzOrName, ...params)
}

/**
 * @template T
 * @param {Container} container
 * @param {function(): T} fn
 * @param {Object} [options]
 * @param {'request'|'global'} [options.scope='request']
 * @returns {T}
 */
export function runWithContainer(container, fn, options = {}) {
  const { scope = 'request' } = options
  return requestContext.run({ container, scope }, fn)
}

/**
 * @typedef {Object} MiddlewareOptions
 * @property {'request'|'global'} [scope='request'] - Container scope mode:
 *   - 'request': Each request gets its own container with isolated singletons (default, SSR-safe)
 *   - 'global': All requests share the global container (use only for stateless services)
 * @property {boolean} [debug=false] - Enable debug logging
 */

/**
 * Express/Connect middleware. scope='request' gives each request isolated singletons (SSR-safe).
 * @param {MiddlewareOptions} [options={}]
 * @returns {function(req, res, next): void}
 */
export function containerMiddleware(options = {}) {
  const { scope = 'request', debug = false } = options

  return (req, res, next) => {
    if (scope === 'global') {
      requestContext.run({ container: globalContainer, scope: 'global' }, () => {
        req.di = globalContainer
        next()
      })
      return
    }

    const container = new Container()
    if (debug) container.setDebug(true)
    req.di = container
    requestContext.run({ container, scope: 'request' }, () => next())
  }
}

/**
 * Koa middleware. See containerMiddleware() for scope behavior.
 * @param {MiddlewareOptions} [options={}]
 * @returns {function(ctx, next): Promise<void>}
 */
export function koaContainerMiddleware(options = {}) {
  const { scope = 'request', debug = false } = options

  return async (ctx, next) => {
    if (scope === 'global') {
      await requestContext.run({ container: globalContainer, scope: 'global' }, async () => {
        ctx.di = globalContainer
        await next()
      })
      return
    }

    const container = new Container()
    if (debug) container.setDebug(true)
    ctx.di = container
    await requestContext.run({ container, scope: 'request' }, () => next())
  }
}

/**
 * Hono/Fastify-style handler wrapper. See containerMiddleware() for scope behavior.
 * @param {MiddlewareOptions} [options={}]
 * @returns {function(handler): function}
 */
export function withContainer(options = {}) {
  const { scope = 'request', debug = false } = options

  return (handler) => (...args) => {
    if (scope === 'global') {
      return requestContext.run({ container: globalContainer, scope: 'global' }, () => handler(...args))
    }

    const container = new Container()
    if (debug) container.setDebug(true)
    return requestContext.run({ container, scope: 'request' }, () => handler(...args))
  }
}
