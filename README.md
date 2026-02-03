# Decorator Dependency Injection

[![npm version](https://badge.fury.io/js/decorator-dependency-injection.svg)](http://badge.fury.io/js/decorator-dependency-injection)
[![npm downloads](https://img.shields.io/npm/dm/decorator-dependency-injection.svg)](https://www.npmjs.com/package/decorator-dependency-injection)
[![Build Status](https://github.com/mallocator/decorator-dependency-injection/actions/workflows/release.yml/badge.svg)](https://github.com/mallocator/decorator-dependency-injection/actions/workflows/release.yml)
[![Coverage](https://img.shields.io/badge/coverage-98%25-brightgreen)](https://github.com/mallocator/decorator-dependency-injection)
[![License](https://img.shields.io/npm/l/decorator-dependency-injection.svg)](https://github.com/mallocator/decorator-dependency-injection/blob/main/LICENSE)

**A lightweight dependency injection (DI) library for JavaScript and TypeScript using native TC39 Stage 3 decorators.**

No reflection. No metadata. No configuration files. Just decorators that work.

**Why this library?**
- Modern TC39 decorator syntax - no `reflect-metadata` or `emitDecoratorMetadata` needed
- Zero dependencies - tiny bundle size
- Built-in mocking support for unit testing with Jest, Vitest, or Mocha
- Full TypeScript support with type inference
- Works with Node.js, Babel, and modern bundlers

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
  - [Singleton](#singleton)
  - [Factory](#factory)
  - [Lazy Injection](#lazy-injection)
  - [Passing Parameters](#passing-parameters)
- [Testing](#testing)
  - [Mocking Dependencies](#mocking-dependencies)
  - [Proxy Mocking](#proxy-mocking)
  - [Test Lifecycle](#test-lifecycle)
  - [Best Practices](#testing-best-practices)
- [Advanced Features](#advanced-features)
  - [Private Fields](#private-fields)
  - [Static Fields](#static-fields)
  - [Named Registrations](#named-registrations)
  - [Manual Resolution](#manual-resolution)
  - [Container Introspection](#container-introspection)
  - [Isolated Containers](#isolated-containers)
- [API Reference](#api-reference)
- [TypeScript Support](#typescript-support)

---

## Quick Start

```javascript
import { Singleton, Inject } from 'decorator-dependency-injection'

@Singleton()
class Database {
  query(sql) { return db.execute(sql) }
}

class UserService {
  @Inject(Database) db

  getUser(id) {
    return this.db.query(`SELECT * FROM users WHERE id = ${id}`)
  }
}

new UserService().getUser(1) // Database is automatically injected
```

**That's it.** The `Database` instance is created once and shared everywhere it's injected.

---

## Installation

```bash
npm install decorator-dependency-injection
```

<details>
<summary><strong>Babel Configuration (required until decorators reach Stage 4)</strong></summary>

Add to your `.babelrc` or `babel.config.json`:

```json
{
  "plugins": ["@babel/plugin-proposal-decorators"]
}
```

Run with Babel:
```bash
npx babel-node index.js
```

For Jest, add to `package.json`:
```json
{
  "jest": {
    "transform": { "^.+\\.jsx?$": "babel-jest" }
  }
}
```

See this project's `package.json` for a complete working example.

</details>

---

## Core Concepts

### Singleton

A singleton creates **one shared instance** across your entire application:

```javascript
import { Singleton, Inject } from 'decorator-dependency-injection'

@Singleton()
class ConfigService {
  apiUrl = 'https://api.example.com'
}

class ServiceA {
  @Inject(ConfigService) config
}

class ServiceB {
  @Inject(ConfigService) config  // Same instance as ServiceA
}
```

### Factory

A factory creates a **new instance** each time it's injected:

```javascript
import { Factory, Inject } from 'decorator-dependency-injection'

@Factory()
class RequestLogger {
  id = Math.random()
}

class Handler {
  @Inject(RequestLogger) logger  // New instance for each Handler
}

new Handler().logger.id !== new Handler().logger.id  // true
```

### Lazy Injection

By default, dependencies are created when the parent class is instantiated. Use `@InjectLazy` to defer creation until first access:

```javascript
import { Singleton, InjectLazy } from 'decorator-dependency-injection'

@Singleton()
class ExpensiveService {
  constructor() {
    console.log('ExpensiveService created')  // Only when accessed
  }
}

class MyClass {
  @InjectLazy(ExpensiveService) service

  doWork() {
    this.service.process()  // ExpensiveService created here
  }
}
```

This is also useful for breaking circular dependencies.

### Passing Parameters

Pass constructor arguments after the class reference:

```javascript
import { Factory, Inject } from 'decorator-dependency-injection'

@Factory()
class Logger {
  constructor(prefix, level) {
    this.prefix = prefix
    this.level = level
  }
}

class MyService {
  @Inject(Logger, 'MyService', 'debug') logger
}
```

For singletons, parameters are only used on the first instantiation.

---

## Testing

### Mocking Dependencies

Use `@Mock` to replace a dependency with a test double:

```javascript
import { Singleton, Mock, removeMock, resolve } from 'decorator-dependency-injection'

@Singleton()
class UserService {
  getUser(id) { return fetchFromDatabase(id) }
}

// In your test file:
@Mock(UserService)
class MockUserService {
  getUser(id) { return { id, name: 'Test User' } }
}

// Now all injections of UserService receive MockUserService
const user = resolve(UserService).getUser(1)  // { id: 1, name: 'Test User' }

// Restore the original
removeMock(UserService)
```

### Proxy Mocking

Mock only specific methods while keeping the rest of the original implementation:

```javascript
@Mock(UserService, true)  // true enables proxy mode
class PartialMock {
  getUser(id) { return { id, name: 'Mocked' } }
  // All other methods delegate to the real UserService
}
```

### Test Lifecycle

| Function | Purpose |
|----------|---------|
| `removeMock(Class)` | Remove a specific mock, restore original |
| `removeAllMocks()` | Remove all mocks, restore all originals |
| `resetSingletons()` | Clear cached instances (keeps mocks) |
| `clearContainer()` | Remove all registrations entirely |

```javascript
import { removeAllMocks, resetSingletons } from 'decorator-dependency-injection'

afterEach(() => {
  removeAllMocks()     // Restore original implementations
  // OR
  resetSingletons()    // Keep mocks, but get fresh instances
})
```

**Note:** These functions remove/restore mocks. They do NOT clear mock call history. If using Vitest/Jest spies, call `.mockClear()` separately.

### Testing Best Practices

```javascript
import { Mock, removeAllMocks, resetSingletons } from 'decorator-dependency-injection'
import { vi, describe, it, beforeEach, afterEach } from 'vitest'

// Hoist mock functions for per-test configuration
const mockGetUser = vi.hoisted(() => vi.fn())

@Mock(UserService)
class MockUserService {
  getUser = mockGetUser
}

describe('MyFeature', () => {
  beforeEach(() => {
    mockGetUser.mockClear()  // Clear call history
    resetSingletons()        // Fresh instances per test
  })

  afterEach(() => {
    removeAllMocks()         // Restore originals
  })

  it('should work', () => {
    mockGetUser.mockReturnValue({ id: 1 })
    // ... test code ...
    expect(mockGetUser).toHaveBeenCalled()
  })
})
```

Additional test utilities:

```javascript
import { isMocked, getMockInstance } from 'decorator-dependency-injection'

// Check if a class is currently mocked
if (isMocked(UserService)) { /* ... */ }

// Access the mock instance to configure it
getMockInstance(UserService).someMethod.mockReturnValue('test')
```

---

## Advanced Features

### Private Fields

Both `@Inject` and `@InjectLazy` support private fields:

```javascript
class UserService {
  @Inject(Database) #db  // Truly private

  getUser(id) {
    return this.#db.query(`SELECT * FROM users WHERE id = ${id}`)
  }
}
```

For lazy injection with private fields, use the `accessor` keyword:

```javascript
class UserService {
  @InjectLazy(Database) accessor #db  // Lazy AND private
}
```

<details>
<summary><strong>Why accessor for lazy private fields?</strong></summary>

JavaScript doesn't allow `Object.defineProperty()` on private fields, so `@InjectLazy` on `#field` creates the instance at construction time (not truly lazy). The `accessor` keyword creates a private backing field with getter/setter that enables true lazy behavior.

</details>

### Static Fields

Inject at the class level (shared across all instances):

```javascript
class ApiService {
  @Inject(Config) static config  // Class-level singleton
  @Inject(Logger) logger         // Instance-level

  getUrl() {
    return ApiService.config.apiUrl
  }
}
```

### Named Registrations

Register dependencies under string names instead of class references:

```javascript
@Singleton('database')
class PostgresDatabase { }

class UserService {
  @Inject('database') db
}
```

### Manual Resolution

Retrieve instances programmatically (useful for non-class code):

```javascript
import { resolve } from 'decorator-dependency-injection'

function handleRequest(req) {
  const userService = resolve(UserService)
  return userService.getUser(req.userId)
}

// With parameters
const logger = resolve(Logger, 'my-module')

// With named registration
const db = resolve('database')
```

### Container Introspection

Debug and inspect the container state:

```javascript
import { 
  getContainer, 
  listRegistrations, 
  isRegistered,
  validateRegistrations,
  setDebug 
} from 'decorator-dependency-injection'

// Check registration status
isRegistered(UserService)  // true/false

// Fail fast at startup
validateRegistrations(UserService, AuthService, 'database')
// Throws if any are missing

// List all registrations
listRegistrations().forEach(reg => {
  console.log(`${reg.name}: ${reg.type}, mocked: ${reg.isMocked}`)
})

// Enable debug logging
setDebug(true)
// [DI] Registered singleton: UserService
// [DI] Creating singleton: UserService
// [DI] Mocked UserService with MockUserService
```

### Isolated Containers

Create separate containers for parallel test execution or module isolation:

```javascript
import { Container } from 'decorator-dependency-injection'

const container = new Container()
container.registerSingleton(MyService)
const instance = container.resolve(MyService)
```

---

## API Reference

### Decorators

| Decorator | Description |
|-----------|-------------|
| `@Singleton(name?)` | Register a class as a singleton |
| `@Factory(name?)` | Register a class as a factory |
| `@Inject(target, ...params)` | Inject a dependency into a field |
| `@InjectLazy(target, ...params)` | Inject lazily (on first access) |
| `@Mock(target, proxy?)` | Replace a dependency with a mock |

### Functions

| Function | Description |
|----------|-------------|
| `resolve(target, ...params)` | Get an instance from the container |
| `removeMock(target)` | Remove a mock, restore original |
| `removeAllMocks()` | Remove all mocks |
| `resetSingletons(options?)` | Clear cached singleton instances |
| `clearContainer(options?)` | Clear all registrations |
| `isRegistered(target)` | Check if target is registered |
| `isMocked(target)` | Check if target is mocked |
| `getMockInstance(target)` | Get the mock instance |
| `validateRegistrations(...targets)` | Throw if any target is not registered |
| `listRegistrations()` | List all registrations |
| `getContainer()` | Get the default container |
| `setDebug(enabled)` | Enable/disable debug logging |
| `unregister(target)` | Remove a registration |

---

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import { Constructor, InjectionToken, RegistrationInfo } from 'decorator-dependency-injection'

// Constructor<T> - a class constructor
const MyClass: Constructor<MyService> = MyService

// InjectionToken<T> - class or string name
const token: InjectionToken<MyService> = MyService
const named: InjectionToken = 'myService'

// RegistrationInfo - from listRegistrations()
// { key, name, type, isMocked, hasInstance }
```

---

## Why Not [Other Library]?

| Feature | This Library | InversifyJS | TSyringe | TypeDI |
|---------|--------------|-------------|----------|--------|
| Native decorators (Stage 3) | Yes | No (legacy) | No (legacy) | No (legacy) |
| Zero dependencies | Yes | No | No | No |
| No reflect-metadata | Yes | No | No | No |
| Built-in mocking | Yes | No | No | No |
| Bundle size | ~3KB | ~50KB | ~15KB | ~20KB |

This library is ideal if you want simple, modern DI without the complexity of container configuration or reflection APIs.

---

## Related Topics

Searching for: JavaScript dependency injection, TypeScript DI container, decorator-based IoC, inversion of control JavaScript, @Inject decorator, @Singleton pattern, service locator pattern, unit test mocking, Jest dependency injection, Vitest mocking.

---

## Version History

- 1.0.0 - Initial release
- 1.0.1 - Automated release with GitHub Actions
- 1.0.2 - Added proxy option to @Mock decorator
- 1.0.3 - Added @InjectLazy decorator
- 1.0.4 - Added Container abstraction, clearContainer(), TypeScript definitions, improved proxy support
- 1.0.5 - Added private field and accessor support for @Inject and @InjectLazy, debug mode, validation helpers
- 1.0.6 - Added resolve() function for non-decorator code
- 1.0.7 - Added more control for mocking in tests and improved compatibility
