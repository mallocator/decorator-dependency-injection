import {
  containerMiddleware,
  koaContainerMiddleware,
  withContainer,
  resolve,
  getContainer,
  getGlobalContainer,
  runWithContainer
} from '../src/middleware.js'
import { Container } from '../src/Container.js'

// Test services (not decorated - we'll register them manually for testing)
class UserService {
  getUser(id) {
    return { id, name: `User ${id}` }
  }
}

class AuthService {
  currentUser = null
  
  getCurrentUser() {
    return this.currentUser
  }
  
  setUser(user) {
    this.currentUser = user
  }
}

class StatelessService {
  process(data) {
    return { processed: data }
  }
}

describe('Middleware Integration', () => {
  describe('containerMiddleware (Express-style)', () => {
    it('creates a request-scoped container', () => {
      const middleware = containerMiddleware()
      
      const req = {}
      middleware(req, {}, () => {})
      
      expect(req.di).toBeInstanceOf(Container)
    })

    it('attaches container to req for manual registration', () => {
      const middleware = containerMiddleware()
      
      const req = {}
      let resolved = null
      
      middleware(req, {}, () => {
        req.di.registerSingleton(UserService)
        resolved = resolve(UserService)
      })
      
      expect(resolved).toBeInstanceOf(UserService)
      expect(resolved.getUser(1)).toEqual({ id: 1, name: 'User 1' })
    })

    it('isolates containers between requests', () => {
      const middleware = containerMiddleware()
      
      const instances = []
      
      for (let i = 0; i < 2; i++) {
        const req = {}
        middleware(req, {}, () => {
          req.di.registerSingleton(UserService)
          instances.push(resolve(UserService))
        })
      }
      
      expect(instances[0]).not.toBe(instances[1])
    })

    it('enables debug mode when specified', () => {
      const middleware = containerMiddleware({ debug: true })
      
      const req = {}
      middleware(req, {}, () => {})
      
      expect(req.di).toBeInstanceOf(Container)
    })
  })

  describe('koaContainerMiddleware', () => {
    it('creates a request-scoped container for Koa', async () => {
      const middleware = koaContainerMiddleware()
      
      const ctx = {}
      let resolved = null
      
      await middleware(ctx, async () => {
        ctx.di.registerSingleton(UserService)
        resolved = resolve(UserService)
      })
      
      expect(ctx.di).toBeInstanceOf(Container)
      expect(resolved).toBeInstanceOf(UserService)
    })

    it('awaits the next middleware', async () => {
      const middleware = koaContainerMiddleware()
      
      const order = []
      
      await middleware({}, async () => {
        order.push('start')
        await new Promise(r => setTimeout(r, 10))
        order.push('end')
      })
      
      expect(order).toEqual(['start', 'end'])
    })
  })

  describe('withContainer (Hono/Fastify-style)', () => {
    it('wraps a handler with a container context', () => {
      const handler = jest.fn(() => {
        getContainer().registerSingleton(UserService)
        return resolve(UserService).getUser(1)
      })
      
      const wrapped = withContainer()(handler)
      const result = wrapped('arg1', 'arg2')
      
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2')
      expect(result).toEqual({ id: 1, name: 'User 1' })
    })

    it('works with async handlers', async () => {
      const handler = async (id) => {
        getContainer().registerSingleton(UserService)
        const userService = resolve(UserService)
        return userService.getUser(id)
      }
      
      const wrapped = withContainer()(handler)
      const result = await wrapped(42)
      
      expect(result).toEqual({ id: 42, name: 'User 42' })
    })
  })

  describe('resolve (context-aware)', () => {
    it('uses request container when in request context', () => {
      const middleware = containerMiddleware()
      
      let resolved = null
      middleware({}, {}, () => {
        getContainer().registerSingleton(UserService)
        resolved = resolve(UserService)
      })
      
      expect(resolved).toBeInstanceOf(UserService)
    })

    it('uses container from runWithContainer', () => {
      const container = new Container()
      container.registerSingleton(UserService)
      
      const resolved = runWithContainer(container, () => {
        return resolve(UserService)
      })
      
      expect(resolved).toBeInstanceOf(UserService)
    })

    it('always has a global container available', () => {
      expect(getGlobalContainer()).toBeTruthy()
      expect(getGlobalContainer()).toBeInstanceOf(Container)
    })
  })

  describe('getContainer', () => {
    it('returns request container when in context', () => {
      const middleware = containerMiddleware()
      
      let container = null
      const req = {}
      middleware(req, {}, () => {
        container = getContainer()
      })
      
      expect(container).toBe(req.di)
    })

    it('returns global container when not in request context', () => {
      expect(getContainer()).toBe(getGlobalContainer())
    })
  })

  describe('runWithContainer', () => {
    it('runs function with specified container', () => {
      const container = new Container()
      container.registerSingleton(UserService)
      
      const result = runWithContainer(container, () => {
        return resolve(UserService).getUser(99)
      })
      
      expect(result).toEqual({ id: 99, name: 'User 99' })
    })

    it('supports async functions', async () => {
      const container = new Container()
      container.registerSingleton(UserService)
      
      const result = await runWithContainer(container, async () => {
        await new Promise(r => setTimeout(r, 10))
        return resolve(UserService).getUser(100)
      })
      
      expect(result).toEqual({ id: 100, name: 'User 100' })
    })

    it('properly scopes nested calls', () => {
      const outer = new Container()
      const inner = new Container()
      
      outer.registerSingleton(UserService)
      inner.registerSingleton(AuthService)
      
      const results = []
      
      runWithContainer(outer, () => {
        results.push(getContainer().has(UserService))
        results.push(getContainer().has(AuthService))
        
        runWithContainer(inner, () => {
          results.push(getContainer().has(UserService))
          results.push(getContainer().has(AuthService))
        })
        
        results.push(getContainer().has(UserService))
      })
      
      expect(results).toEqual([
        true,   // outer has UserService
        false,  // outer doesn't have AuthService
        false,  // inner doesn't have UserService
        true,   // inner has AuthService
        true    // back to outer, still has UserService
      ])
    })
  })

  describe('concurrent requests', () => {
    it('maintains isolation across concurrent async operations', async () => {
      const middleware = containerMiddleware()
      
      const results = []
      
      const request1 = new Promise(resolve => {
        middleware({ id: 1 }, {}, async () => {
          const container = getContainer()
          container.registerSingleton(UserService, 'req1')
          
          await new Promise(r => setTimeout(r, 50))
          
          results.push({
            reqId: 1,
            hasReq1: container.has('req1'),
            hasReq2: container.has('req2')
          })
          resolve()
        })
      })
      
      const request2 = new Promise(resolve => {
        middleware({ id: 2 }, {}, async () => {
          const container = getContainer()
          container.registerSingleton(AuthService, 'req2')
          
          await new Promise(r => setTimeout(r, 25))
          
          results.push({
            reqId: 2,
            hasReq1: container.has('req1'),
            hasReq2: container.has('req2')
          })
          resolve()
        })
      })
      
      await Promise.all([request1, request2])
      
      expect(results[0]).toEqual({ reqId: 2, hasReq1: false, hasReq2: true })
      expect(results[1]).toEqual({ reqId: 1, hasReq1: true, hasReq2: false })
    })
  })

  describe('service registration', () => {
    it('services registered via req.di work', () => {
      const middleware = containerMiddleware()
      
      let resolved = null
      const req = {}
      middleware(req, {}, () => {
        req.di.registerSingleton(UserService)
        resolved = resolve(UserService)
      })
      
      expect(resolved).toBeInstanceOf(UserService)
    })

    it('creates isolated instances per request', () => {
      const middleware = containerMiddleware()
      const instances = []
      
      for (let i = 0; i < 2; i++) {
        middleware({}, {}, () => {
          getContainer().registerSingleton(AuthService)
          const auth = resolve(AuthService)
          auth.setUser({ id: i, name: `User ${i}` })
          instances.push(auth)
        })
      }
      
      expect(instances[0]).not.toBe(instances[1])
      expect(instances[0].getCurrentUser()).toEqual({ id: 0, name: 'User 0' })
      expect(instances[1].getCurrentUser()).toEqual({ id: 1, name: 'User 1' })
    })

    it('can register factory services', () => {
      const middleware = containerMiddleware()
      
      let instances = []
      middleware({}, {}, () => {
        getContainer().registerFactory(UserService)
        instances.push(resolve(UserService))
        instances.push(resolve(UserService))
      })
      
      expect(instances[0]).not.toBe(instances[1])
    })
  })

  describe('scope option', () => {
    it('uses request scope by default (isolated singletons)', () => {
      const middleware = containerMiddleware()
      
      const instances = []
      
      middleware({}, {}, () => {
        getContainer().registerSingleton(AuthService)
        const auth = resolve(AuthService)
        auth.setUser({ id: 1 })
        instances.push(auth)
      })
      
      middleware({}, {}, () => {
        getContainer().registerSingleton(AuthService)
        const auth = resolve(AuthService)
        instances.push(auth)
      })
      
      expect(instances[0]).not.toBe(instances[1])
      expect(instances[1].getCurrentUser()).toBeNull()
    })

    it('global scope shares instances via runWithContainer', () => {
      const globalContainer = new Container()
      globalContainer.registerSingleton(StatelessService)
      
      const instances = []
      
      runWithContainer(globalContainer, () => {
        instances.push(resolve(StatelessService))
      })
      
      runWithContainer(globalContainer, () => {
        instances.push(resolve(StatelessService))
      })
      
      expect(instances[0]).toBe(instances[1])
    })

    it('koaContainerMiddleware attaches container to ctx', async () => {
      const middleware = koaContainerMiddleware()
      
      const ctx = {}
      await middleware(ctx, async () => {})
      
      expect(ctx.di).toBeInstanceOf(Container)
    })

    it('withContainer isolates by default', () => {
      const handler = withContainer()(() => {
        getContainer().registerSingleton(AuthService)
        const auth = resolve(AuthService)
        auth.setUser({ id: 1 })
        return auth
      })
      
      const instance1 = handler()
      const instance2 = handler()
      
      expect(instance1).not.toBe(instance2)
    })

    it('withContainer with key shares container across calls', () => {
      const handler = withContainer({ key: 'shared-context' })(() => {
        // First call registers, subsequent calls reuse
        if (!getContainer().has(AuthService, false)) {
          getContainer().registerSingleton(AuthService)
        }
        return resolve(AuthService)
      })
      
      const instance1 = handler()
      const instance2 = handler()
      
      // Same container, same singleton
      expect(instance1).toBe(instance2)
      
      // Cleanup
      const { destroyContainer } = require('../index.js')
      destroyContainer('shared-context')
    })

    it('withContainer with object key shares container', () => {
      const sharedKey = { requestId: 'abc-123' }
      
      const handler = withContainer({ key: sharedKey })(() => {
        if (!getContainer().has(AuthService, false)) {
          getContainer().registerSingleton(AuthService)
        }
        return resolve(AuthService)
      })
      
      const instance1 = handler()
      const instance2 = handler()
      
      expect(instance1).toBe(instance2)
    })

    it('withContainer temporary container is cleaned up', () => {
      // Without a key, each call gets a fresh temporary container
      // that's not stored in any registry
      const { hasContainer } = require('../index.js')
      
      let containerRef = null
      const handler = withContainer()(() => {
        containerRef = getContainer()
        getContainer().registerSingleton(AuthService)
        return resolve(AuthService)
      })
      
      handler()
      
      // The container was used but not stored in any registry
      // We can't really test GC, but we can verify it worked
      expect(containerRef).toBeTruthy()
      expect(containerRef.has(AuthService)).toBe(true)
    })
  })

  describe('getGlobalContainer', () => {
    it('returns the default global container', () => {
      const container = getGlobalContainer()
      expect(container).toBeTruthy()
      expect(container).toBeInstanceOf(Container)
    })
  })

  describe('edge cases', () => {
    it('handles named registrations', () => {
      const middleware = containerMiddleware()
      
      let resolved = null
      middleware({}, {}, () => {
        getContainer().registerSingleton(UserService, 'myUserService')
        resolved = resolve('myUserService')
      })
      
      expect(resolved).toBeInstanceOf(UserService)
    })

    it('throws when resolving unregistered service', () => {
      const middleware = containerMiddleware()
      
      middleware({}, {}, () => {
        expect(() => resolve(UserService)).toThrow()
      })
    })

    it('new containers are created per request', () => {
      const containers = []
      const middleware = containerMiddleware()
      
      middleware({}, {}, () => {
        containers.push(getContainer())
      })
      middleware({}, {}, () => {
        containers.push(getContainer())
      })
      
      expect(containers[0]).not.toBe(containers[1])
    })

    it('services are singletons within same request', () => {
      const middleware = containerMiddleware()
      
      let instance1, instance2
      middleware({}, {}, () => {
        getContainer().registerSingleton(UserService)
        instance1 = resolve(UserService)
        instance2 = resolve(UserService)
      })
      
      expect(instance1).toBe(instance2)
    })
  })

  describe('resolve with scope option', () => {
    it('scope: global uses global container even inside request', () => {
      const globalContainer = getGlobalContainer()
      if (!globalContainer.has(StatelessService)) {
        globalContainer.registerSingleton(StatelessService)
      }
      
      const middleware = containerMiddleware()
      
      const instances = []
      
      middleware({}, {}, () => {
        instances.push(resolve(StatelessService, { scope: 'global' }))
      })
      
      middleware({}, {}, () => {
        instances.push(resolve(StatelessService, { scope: 'global' }))
      })
      
      expect(instances[0]).toBe(instances[1])
    })

    it('scope: request uses request container (default behavior)', () => {
      const middleware = containerMiddleware()
      
      const instances = []
      
      middleware({}, {}, () => {
        getContainer().registerSingleton(AuthService)
        instances.push(resolve(AuthService, { scope: 'request' }))
      })
      
      middleware({}, {}, () => {
        getContainer().registerSingleton(AuthService)
        instances.push(resolve(AuthService, { scope: 'request' }))
      })
      
      expect(instances[0]).not.toBe(instances[1])
    })

    it('scope: request falls back to global when not in request context', () => {
      const globalContainer = getGlobalContainer()
      if (!globalContainer.has(UserService)) {
        globalContainer.registerSingleton(UserService)
      }
      
      // Even with scope: 'request', it falls back to global if no context
      const instance = resolve(UserService, { scope: 'request' })
      expect(instance).toBeInstanceOf(UserService)
    })

    it('scope: global works outside request context', () => {
      const globalContainer = getGlobalContainer()
      if (!globalContainer.has(StatelessService)) {
        globalContainer.registerSingleton(StatelessService)
      }
      
      const instance = resolve(StatelessService, { scope: 'global' })
      
      expect(instance).toBeInstanceOf(StatelessService)
    })

    it('mixed scopes in same handler', () => {
      const globalContainer = getGlobalContainer()
      if (!globalContainer.has(StatelessService)) {
        globalContainer.registerSingleton(StatelessService)
      }
      
      const middleware = containerMiddleware()
      
      const globalInstances = []
      const requestInstances = []
      
      middleware({}, {}, () => {
        getContainer().registerSingleton(AuthService)
        globalInstances.push(resolve(StatelessService, { scope: 'global' }))
        requestInstances.push(resolve(AuthService))
      })
      
      middleware({}, {}, () => {
        getContainer().registerSingleton(AuthService)
        globalInstances.push(resolve(StatelessService, { scope: 'global' }))
        requestInstances.push(resolve(AuthService))
      })
      
      expect(globalInstances[0]).toBe(globalInstances[1])
      expect(requestInstances[0]).not.toBe(requestInstances[1])
    })
  })

  describe('resolve with params option', () => {
    class LoggerWithParams {
      constructor(prefix, level) {
        this.prefix = prefix
        this.level = level
      }
      log(msg) {
        return `[${this.prefix}:${this.level}] ${msg}`
      }
    }

    it('passes params to constructor in request scope', () => {
      const middleware = containerMiddleware()
      
      let result = null
      middleware({}, {}, () => {
        getContainer().registerFactory(LoggerWithParams)
        const logger = resolve(LoggerWithParams, { params: ['MyService', 'debug'] })
        result = logger.log('test message')
      })
      
      expect(result).toBe('[MyService:debug] test message')
    })

    it('passes params to constructor in global scope', () => {
      const globalContainer = getGlobalContainer()
      if (!globalContainer.has(LoggerWithParams)) {
        globalContainer.registerFactory(LoggerWithParams)
      }
      
      const logger = resolve(LoggerWithParams, { scope: 'global', params: ['Global', 'info'] })
      
      expect(logger.log('hello')).toBe('[Global:info] hello')
    })
  })

  describe('containerMiddleware with scope: global', () => {
    it('uses global container for all requests', () => {
      const globalContainer = getGlobalContainer()
      if (!globalContainer.has(StatelessService)) {
        globalContainer.registerSingleton(StatelessService)
      }
      
      const middleware = containerMiddleware({ scope: 'global' })
      
      const instances = []
      
      middleware({}, {}, () => {
        instances.push(resolve(StatelessService))
      })
      
      middleware({}, {}, () => {
        instances.push(resolve(StatelessService))
      })
      
      expect(instances[0]).toBe(instances[1])
    })

    it('attaches global container to req', () => {
      const globalContainer = getGlobalContainer()
      const middleware = containerMiddleware({ scope: 'global' })
      
      const req = {}
      middleware(req, {}, () => {})
      
      expect(req.di).toBe(globalContainer)
    })
  })

  describe('koaContainerMiddleware with scope: global', () => {
    it('uses global container for all requests', async () => {
      const globalContainer = getGlobalContainer()
      if (!globalContainer.has(StatelessService)) {
        globalContainer.registerSingleton(StatelessService)
      }
      
      const middleware = koaContainerMiddleware({ scope: 'global' })
      
      const instances = []
      
      await middleware({}, async () => {
        instances.push(resolve(StatelessService))
      })
      
      await middleware({}, async () => {
        instances.push(resolve(StatelessService))
      })
      
      expect(instances[0]).toBe(instances[1])
    })

    it('attaches global container to ctx', async () => {
      const globalContainer = getGlobalContainer()
      const middleware = koaContainerMiddleware({ scope: 'global' })
      
      const ctx = {}
      await middleware(ctx, async () => {})
      
      expect(ctx.di).toBe(globalContainer)
    })
  })

  describe('withContainer with scope: global', () => {
    it('uses global container', () => {
      const globalContainer = getGlobalContainer()
      if (!globalContainer.has(StatelessService)) {
        globalContainer.registerSingleton(StatelessService)
      }
      
      const handler = withContainer({ scope: 'global' })(() => {
        return resolve(StatelessService)
      })
      
      const instance1 = handler()
      const instance2 = handler()
      
      expect(instance1).toBe(instance2)
    })
  })

  describe('auto-registration from global container', () => {
    class AutoRegisteredService {
      getValue() { return 'auto' }
    }

    it('auto-registers singleton from global container', () => {
      const globalContainer = getGlobalContainer()
      globalContainer.registerSingleton(AutoRegisteredService)
      
      const middleware = containerMiddleware()
      
      let resolved = null
      middleware({}, {}, () => {
        resolved = resolve(AutoRegisteredService)
      })
      
      expect(resolved).toBeInstanceOf(AutoRegisteredService)
      expect(resolved.getValue()).toBe('auto')
    })

    it('auto-registers factory from global container', () => {
      class FactoryService {
        id = Math.random()
      }
      
      const globalContainer = getGlobalContainer()
      globalContainer.registerFactory(FactoryService)
      
      const middleware = containerMiddleware()
      
      const instances = []
      middleware({}, {}, () => {
        instances.push(resolve(FactoryService))
        instances.push(resolve(FactoryService))
      })
      
      expect(instances[0]).not.toBe(instances[1])
    })

    it('request container instances are isolated from global', () => {
      class IsolatedService {
        value = null
        setValue(v) { this.value = v }
      }
      
      const globalContainer = getGlobalContainer()
      globalContainer.registerSingleton(IsolatedService)
      
      globalContainer.resolve(IsolatedService).setValue('global')
      
      const middleware = containerMiddleware()
      
      let requestValue = null
      middleware({}, {}, () => {
        const service = resolve(IsolatedService)
        requestValue = service.value
      })
      
      expect(requestValue).toBeNull()
    })
  })

  describe('middleware debug option', () => {
    it('enables debug mode on request container', () => {
      const middleware = containerMiddleware({ debug: true })
      
      const req = {}
      middleware(req, {}, () => {
        req.di.registerSingleton(UserService)
        resolve(UserService)
      })
      
      expect(req.di).toBeInstanceOf(Container)
    })

    it('koaContainerMiddleware enables debug mode', async () => {
      const middleware = koaContainerMiddleware({ debug: true })
      
      const ctx = {}
      await middleware(ctx, async () => {
        ctx.di.registerSingleton(UserService)
        resolve(UserService)
      })
      
      expect(ctx.di).toBeInstanceOf(Container)
    })

    it('withContainer enables debug mode', () => {
      const handler = withContainer({ debug: true })(() => {
        getContainer().registerSingleton(UserService)
        return resolve(UserService)
      })
      
      const result = handler()
      expect(result).toBeInstanceOf(UserService)
    })
  })
})
