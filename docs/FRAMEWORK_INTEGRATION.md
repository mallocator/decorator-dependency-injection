# Framework and Environment Integration

This guide shows how to use decorator-dependency-injection with frontend frameworks, SSR, and various deployment targets.

## Table of Contents

- [Quick Setup](#quick-setup)
  - [React](#react)
  - [Vue 3](#vue-3)
  - [Svelte](#svelte)
- [Project Structure](#project-structure)
- [Frontend Frameworks](#frontend-frameworks)
  - [React](#react-1)
  - [Vue 3](#vue-3-1)
  - [Svelte](#svelte-1)
  - [Angular](#angular)
- [Server-Side Rendering](#server-side-rendering)
- [Node.js Server Middleware](#nodejs-server-middleware)
- [Bundler Configuration](#bundler-configuration)
  - [Vite](#vite)
  - [Webpack](#webpack-create-react-app-etc)
  - [esbuild](#esbuild)
  - [Bun](#bun)
- [Runtime Environments](#runtime-environments)
  - [Node.js](#nodejs)
  - [AWS Lambda](#aws-lambda)
  - [Cloudflare Workers / Vercel Edge](#cloudflare-workers--vercel-edge)
  - [Electron](#electron)
- [Troubleshooting](#troubleshooting)

---

## Quick Setup

### React

```jsx
// services/UserService.js
import { Singleton } from 'decorator-dependency-injection'

@Singleton()
export class UserService {
  async getUser(id) {
    const res = await fetch(`/api/users/${id}`)
    return res.json()
  }
}

// components/UserProfile.jsx
import { resolve } from 'decorator-dependency-injection'
import { useState, useEffect, useMemo } from 'react'
import { UserService } from '../services/UserService'

export function UserProfile({ userId }) {
  const [user, setUser] = useState(null)
  const userService = useMemo(() => resolve(UserService), [])

  useEffect(() => {
    userService.getUser(userId).then(setUser)
  }, [userId, userService])

  return <div>{user?.name}</div>
}
```

### Vue 3

```javascript
// services/UserService.js
import { Singleton } from 'decorator-dependency-injection'

@Singleton()
export class UserService {
  async getUser(id) {
    const res = await fetch(`/api/users/${id}`)
    return res.json()
  }
}
```

```vue
<!-- components/UserProfile.vue -->
<script setup>
import { ref, onMounted } from 'vue'
import { resolve } from 'decorator-dependency-injection'
import { UserService } from '../services/UserService'

const userService = resolve(UserService)
const user = ref(null)

onMounted(async () => {
  user.value = await userService.getUser(1)
})
</script>

<template>
  <div>{{ user?.name }}</div>
</template>
```

### Svelte

```javascript
// services/UserService.js
import { Singleton } from 'decorator-dependency-injection'

@Singleton()
export class UserService {
  async getUser(id) {
    const res = await fetch(`/api/users/${id}`)
    return res.json()
  }
}
```

```svelte
<!-- components/UserProfile.svelte -->
<script>
  import { onMount } from 'svelte'
  import { resolve } from 'decorator-dependency-injection'
  import { UserService } from '../services/UserService'

  const userService = resolve(UserService)
  let user = null

  onMount(async () => {
    user = await userService.getUser(1)
  })
</script>

<div>{user?.name}</div>
```

---

## Project Structure

Recommended organization for DI-based projects:

```
src/
├── services/           # Classes with @Singleton/@Factory
│   ├── UserService.js
│   ├── AuthService.js
│   └── ApiClient.js
├── components/         # UI components (use resolve())
│   └── UserProfile.jsx
├── hooks/              # Optional: framework-specific wrappers
│   └── useService.js
└── index.js            # App entry point
```

**Key principle**: Keep your service layer (classes with decorators) separate from your UI layer (components that use `resolve()`).

### Optional: Custom Hook/Composable

If you find yourself writing `useMemo(() => resolve(...), [])` repeatedly:

```javascript
// hooks/useService.js (React)
import { useMemo } from 'react'
import { resolve } from 'decorator-dependency-injection'

export function useService(ServiceClass) {
  return useMemo(() => resolve(ServiceClass), [ServiceClass])
}

// Usage
const userService = useService(UserService)
```

---

## Frontend Frameworks

### React

The `resolve()` call should be memoized to avoid creating lookups on every render:

```jsx
import { resolve } from 'decorator-dependency-injection'
import { useMemo } from 'react'

function MyComponent() {
  // Memoize the resolution
  const userService = useMemo(() => resolve(UserService), [])
  
  // Now use userService in effects, handlers, etc.
}
```

#### With TanStack Query

```jsx
import { useQuery } from '@tanstack/react-query'
import { resolve } from 'decorator-dependency-injection'
import { useMemo } from 'react'

function UserProfile({ userId }) {
  const userService = useMemo(() => resolve(UserService), [])

  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userService.getUser(userId)
  })

  return <div>{user?.name}</div>
}
```

### Vue 3

In Vue's Composition API, `resolve()` can be called directly in `<script setup>`:

```vue
<script setup>
import { resolve } from 'decorator-dependency-injection'

// Called once during setup - no memoization needed
const userService = resolve(UserService)
</script>
```

#### With Pinia

```javascript
import { defineStore } from 'pinia'
import { resolve } from 'decorator-dependency-injection'

export const useUserStore = defineStore('user', {
  state: () => ({ user: null }),
  actions: {
    async fetchUser(id) {
      const userService = resolve(UserService)
      this.user = await userService.getUser(id)
    }
  }
})
```

### Svelte

In Svelte, `resolve()` in the `<script>` block runs once per component instance:

```svelte
<script>
  import { resolve } from 'decorator-dependency-injection'
  
  const userService = resolve(UserService)
</script>
```

### Angular

Angular has its own DI system. If you need to bridge:

```typescript
import { Injectable } from '@angular/core'
import { resolve } from 'decorator-dependency-injection'

@Injectable({ providedIn: 'root' })
export class UserServiceBridge {
  private service = resolve(UserService)
  
  getUser(id: number) {
    return this.service.getUser(id)
  }
}
```

Generally, stick with Angular's native DI for Angular projects.

---

## Server-Side Rendering

### The Problem

Singletons persist across requests on the server, potentially leaking user data:

```javascript
@Singleton()
class AuthService {
  currentUser = null  // DANGER: Shared across ALL requests!
}
```

### The Solution

Create a new container per request:

```javascript
import { Container } from 'decorator-dependency-injection'

async function handleRequest(req) {
  // Each request gets its own container
  const container = new Container()
  container.registerSingleton(AuthService)
  container.registerSingleton(UserService)

  // This instance is isolated to this request
  const auth = container.resolve(AuthService)
  auth.currentUser = req.user

  // Process request with isolated state
  const userService = container.resolve(UserService)
  return await userService.getData()
}
```

This pattern works identically in **Next.js**, **Nuxt**, **SvelteKit**, **Remix**, or any SSR framework.

### Client vs Server

| Context | Container | Why |
|---------|-----------|-----|
| Client (browser) | Global (default) | One user per browser tab |
| Server (SSR) | Per-request | Multiple users share the process |
| API Routes | Per-request | Same as SSR |

### Example: Next.js App Router

```javascript
// app/users/[id]/page.js
import { Container } from 'decorator-dependency-injection'

export default async function UserPage({ params }) {
  const container = new Container()
  container.registerSingleton(UserService)

  const userService = container.resolve(UserService)
  const user = await userService.getUser(params.id)

  return <div>{user.name}</div>
}
```

```javascript
// Client component - uses global container (safe)
'use client'
import { resolve } from 'decorator-dependency-injection'
import { useMemo } from 'react'

export function UserProfile({ userId }) {
  const userService = useMemo(() => resolve(UserService), [])
  // ...
}
```

---

## Node.js Server Middleware

For Express, Koa, Fastify, Hono, and other Node.js servers, we provide middleware that automatically creates **request-scoped containers** using `AsyncLocalStorage`.

### ⚠️ Important: How Request Scoping Works

When you use this middleware, **a new container is created for each HTTP request**:

```
Request 1 ──────────────────────────────────────────────────────►
           │ Container A created │ UserService instance A │ Container A garbage collected
           
Request 2 ──────────────────────────────────────────────────────►
           │ Container B created │ UserService instance B │ Container B garbage collected
```

**Key points:**
- `resolve()` from `decorator-dependency-injection/middleware` returns instances from the **current request's container**
- Singletons are **isolated per-request** - each request gets its own instance
- This prevents data leaking between users (critical for SSR safety)
- Services are **auto-registered** from the global container - no need to list them explicitly

### Basic Setup (Recommended)

```javascript
import express from 'express'
import { containerMiddleware, resolve } from 'decorator-dependency-injection/middleware'

const app = express()

// Creates a new container for each request
app.use(containerMiddleware())

app.get('/users/:id', async (req, res) => {
  // This UserService instance is ISOLATED to this request
  // @Singleton() decorated services are auto-registered
  const userService = resolve(UserService)
  const user = await userService.getUser(req.params.id)
  res.json(user)
})

app.listen(3000)
```

### Why Request Scoping Matters

Without request scoping, stateful services leak between users:

```javascript
// ❌ DANGEROUS - shared across ALL requests
@Singleton()
class AuthService {
  currentUser = null  // User A's data leaks to User B!
}

// ✅ SAFE - with request-scoped containers
app.use(containerMiddleware())

app.get('/me', (req, res) => {
  const auth = resolve(AuthService)  // Fresh instance per request
  auth.currentUser = req.user        // Safe! Isolated to this request
  res.json(auth.currentUser)
})
```

### Scope Options

You can control the scope per-middleware:

| Scope | Behavior | Use Case |
|-------|----------|----------|
| `'request'` (default) | New container per request, isolated singletons | Stateful services, SSR, user-specific data |
| `'global'` | Use the global container directly | Stateless services, connection pools, config |

```javascript
// Request scope (default) - isolated singletons
app.use(containerMiddleware())  // or { scope: 'request' }

// Global scope - shared singletons (use carefully!)
app.use(containerMiddleware({ scope: 'global' }))
```

**When to use global scope:**
- Database connection pools (should be shared)
- Configuration services (immutable, stateless)
- Caches (shared across requests)

**When to use request scope (default):**
- Authentication/session services
- Request-specific loggers
- Any service that holds user state

### Mixing Scopes in the Same Handler

Sometimes you need both request-scoped and global services in the same handler. Use the `scope` option on `resolve()`:

```javascript
import { containerMiddleware, resolve } from 'decorator-dependency-injection/middleware'

app.use(containerMiddleware())

app.get('/users/:id', async (req, res) => {
  // Request-scoped (default) - isolated per request
  const authService = resolve(AuthService)
  
  // Explicitly global - shared across all requests
  const dbPool = resolve(DatabasePool, { scope: 'global' })
  const cache = resolve(CacheService, { scope: 'global' })
  
  // Use both together
  const user = await dbPool.query('SELECT * FROM users WHERE id = ?', [req.params.id])
  authService.setUser(user)  // Safe - isolated to this request
  
  res.json(user)
})
```

**Alternative:** Import `resolve` from the main module as `resolveGlobal`:

```javascript
import { containerMiddleware, resolve } from 'decorator-dependency-injection/middleware'
import { resolve as resolveGlobal } from 'decorator-dependency-injection'

app.get('/users/:id', async (req, res) => {
  const authService = resolve(AuthService)       // Request-scoped
  const dbPool = resolveGlobal(DatabasePool)     // Global
  // ...
})
```

**Warning behavior:** If you explicitly request `{ scope: 'request' }` but no middleware is set up, a warning is logged:

```javascript
// Outside any request context
const auth = resolve(AuthService, { scope: 'request' })
// ⚠️ Console: [DI] resolve() called with scope='request' but no request context exists...
```

### Koa

```javascript
import Koa from 'koa'
import { koaContainerMiddleware, resolve } from 'decorator-dependency-injection/middleware'

const app = new Koa()
app.use(koaContainerMiddleware())

app.use(async (ctx) => {
  const userService = resolve(UserService)  // Request-scoped
  ctx.body = await userService.getUser(ctx.params.id)
})
```

### Hono / Fastify (Handler Wrapper)

```javascript
import { Hono } from 'hono'
import { withContainer, resolve } from 'decorator-dependency-injection/middleware'

const app = new Hono()

app.get('/users/:id', withContainer()(async (c) => {
  const userService = resolve(UserService)
  return c.json(await userService.getUser(c.req.param('id')))
}))
```

### How Auto-Registration Works

When you call `resolve(UserService)`:

1. Middleware checks if `UserService` is registered in the request container
2. If not, it looks up the registration in the **global container** (where `@Singleton()` registered it)
3. It copies the registration type (singleton/factory) to the request container
4. A new instance is created **in the request container**

The global container is automatically set to the default container from the main module when you import `decorator-dependency-injection/middleware` - no manual setup needed.

### Direct Container Access

You can access the request's DI container directly via `req.di`:

```javascript
app.get('/users/:id', async (req, res) => {
  // Recommended: use resolve()
  const userService = resolve(UserService)
  
  // Alternative: direct container access via req.di
  console.log(req.di.has(UserService))  // true after first resolve
  
  // Register request-specific services
  req.di.registerSingleton(RequestLogger)
})
```

### Testing with runWithContainer

For unit tests, use `runWithContainer` to control the container:

```javascript
import { runWithContainer, resolve } from 'decorator-dependency-injection/middleware'
import { Container } from 'decorator-dependency-injection'

it('uses the mocked service', () => {
  const testContainer = new Container()
  testContainer.registerSingleton(MockUserService)

  const result = runWithContainer(testContainer, () => {
    return resolve(UserService).getUser(1)  // Gets MockUserService
  })

  expect(result).toEqual({ id: 1, name: 'Mock User' })
})
```

---

## Bundler Configuration

Decorators require transpilation. Here's the setup for common bundlers:

### Vite

```bash
npm install -D @babel/core @babel/plugin-proposal-decorators
```

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { version: '2023-11' }]
        ]
      }
    })
  ]
})
```

### Webpack (Create React App, etc.)

```bash
npm install -D @babel/plugin-proposal-decorators
```

```javascript
// babel.config.js
module.exports = {
  plugins: [
    ['@babel/plugin-proposal-decorators', { version: '2023-11' }]
  ]
}
```

### esbuild

esbuild doesn't support decorators natively. Use esbuild-plugin-babel:

```bash
npm install -D esbuild-plugin-babel @babel/core @babel/plugin-proposal-decorators
```

```javascript
import babel from 'esbuild-plugin-babel'

esbuild.build({
  plugins: [
    babel({
      filter: /\.js$/,
      config: {
        plugins: [['@babel/plugin-proposal-decorators', { version: '2023-11' }]]
      }
    })
  ]
})
```

### Bun

Bun supports TC39 decorators natively - no configuration needed:

```bash
bun run index.js
```

---

## Runtime Environments

### Node.js

Requires Babel:

```bash
npm install -D @babel/core @babel/node @babel/plugin-proposal-decorators
npx babel-node index.js
```

### Bun

Native support, no setup required.

### AWS Lambda

Works well - each Lambda instance has its own container. Singletons persist across warm invocations (efficient for connection pooling, etc.):

```javascript
import { resolve } from 'decorator-dependency-injection'

export const handler = async (event) => {
  const userService = resolve(UserService)
  return await userService.getUser(event.userId)
}
```

### Cloudflare Workers / Vercel Edge

These environments have limited decorator support. Use programmatic registration:

```javascript
import { Container } from 'decorator-dependency-injection'

// Define classes without decorators
class UserService {
  getUser(id) { /* ... */ }
}

export default {
  async fetch(request) {
    const container = new Container()
    container.registerSingleton(UserService)

    const userService = container.resolve(UserService)
    return Response.json(await userService.getUser(1))
  }
}
```

### Electron

Main and renderer processes have separate JavaScript contexts - each has its own container automatically.

---

## Troubleshooting

### "X is not registered"

**Cause**: The class wasn't decorated with `@Singleton()` or `@Factory()`, or the decorator hasn't run yet.

**Fix**:
1. Ensure the class has `@Singleton()` or `@Factory()`
2. Import the service file before calling `resolve()` (decorators run at import time)

```javascript
// Wrong - UserService not imported yet
const userService = resolve(UserService)  // Error!

// Correct
import { UserService } from './services/UserService'  // Decorator runs here
const userService = resolve(UserService)  // Works
```

### Stale singletons after code changes (HMR)

During development, singleton instances persist across hot reloads.

**Fix**: Clear the container on HMR:

```javascript
// Vite
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    clearContainer({ preserveRegistrations: true })
  })
}

// Webpack
if (module.hot) {
  module.hot.accept('./services', () => {
    clearContainer({ preserveRegistrations: true })
  })
}
```

### "Cannot use decorators" / Syntax Error

**Cause**: Bundler isn't configured to transpile decorators.

**Fix**: See [Bundler Configuration](#bundler-configuration) above.

### SSR: Data leaking between requests

**Cause**: Using global container on server.

**Fix**: Create a new `Container()` per request. See [Server-Side Rendering](#server-side-rendering).

### Mock not working in tests

**Cause**: Mock defined after the code that uses the service runs.

**Fix**: Define mocks before importing code that resolves services:

```javascript
// test file
import { Mock, removeAllMocks } from 'decorator-dependency-injection'

// Define mock FIRST
@Mock(UserService)
class MockUserService {
  getUser = vi.fn().mockResolvedValue({ id: 1 })
}

// THEN import the component that uses UserService
import { UserProfile } from './UserProfile'

afterEach(() => removeAllMocks())
```

### Circular dependency error

**Cause**: ServiceA imports ServiceB which imports ServiceA.

**Fix**: Use `@InjectLazy` to break the cycle:

```javascript
@Singleton()
class ServiceA {
  @InjectLazy(ServiceB) serviceB  // Deferred until first access
}

@Singleton()
class ServiceB {
  @Inject(ServiceA) serviceA
}
```

---

## Environment Support Matrix

| Environment | Decorators | Notes |
|-------------|------------|-------|
| Node.js + Babel | Yes | Full support |
| Bun | Yes | Native support |
| Vite | Yes | With Babel plugin |
| Webpack | Yes | With Babel plugin |
| AWS Lambda | Yes | Singletons persist across warm starts |
| Cloudflare Workers | No | Use programmatic `Container` API |
| Vercel Edge | No | Use programmatic `Container` API |
| Electron | Yes | Separate container per process |
