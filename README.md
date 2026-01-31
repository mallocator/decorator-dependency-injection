# Decorator Dependency Injection

[![npm version](https://badge.fury.io/js/decorator-dependency-injection.svg)](http://badge.fury.io/js/decorator-dependency-injection)
[![Build Status](https://github.com/mallocator/decorator-dependency-injection/actions/workflows/release.yml/badge.svg)](https://github.com/mallocator/decorator-dependency-injection/actions/workflows/release.yml)
[![Coverage](https://img.shields.io/badge/coverage-93%25-brightgreen)](https://github.com/mallocator/decorator-dependency-injection)

## Description

With the [TC39 proposal-decorators](https://github.com/tc39/proposal-decorators) reaching stage 3, it's time to start
thinking about how we can use them in our projects. One of the most common patterns in JavaScript is dependency
injection. This pattern is used to make our code more testable and maintainable. This library provides simple decorators
to help you inject dependencies into your classes and mock them for testing.

## Installation

```bash
npm install decorator-dependency-injection
```

Until we reach stage 4, you will need to enable the decorators proposal in your project. You can do this by adding the
following babel transpiler options to your `.babelrc` file.

```json
{
  "plugins": [
    "@babel/plugin-proposal-decorators"
  ]
}
```

To run your project with decorators enabled, you will need to use the babel transpiler. You can do this by running the
following command in your project root.

```bash
npx babel-node index.js
```

Finally, for running tests with decorators enabled, you will need to use the babel-jest package. You can do this by
adding the following configuration to your `package.json` file.

```json
{
  "jest": {
    "transform": {
      "^.+\\.jsx?$": "babel-jest"
    }
  }
}
```

Other testing frameworks may require a different configuration.

For a full example of how to set up a project with decorators, see this project's ```package.json``` file.

## Usage

There are two ways of specifying injectable dependencies: ```@Singleton``` and ```@Factory```:

### Singleton

The ```@Singleton``` decorator is used to inject a single instance of a dependency into a class. This is useful when you
want to share the same instance of a class across multiple classes.

```javascript
import {Singleton, Inject} from 'decorator-dependency-injection';

@Singleton()
class Dependency {
}

class Consumer {
  @Inject(Dependency) dependency // creates an instance only once
}
```

### Factory

The ```@Factory``` decorator is used to inject a new instance of a dependency into a class each time it is requested.
This is useful when you want to create a new instance of a class each time it is injected.

```javascript
import {Factory, Inject} from 'decorator-dependency-injection';

@Factory()
class Dependency {
}

class Consumer {
  @Inject(Dependency) dependency // creates a new instance each time a new Consumer is created
}
```

### InjectLazy

```@Inject``` annotated properties are evaluated during instance initialization. That means that all properties should
be accessible in the constructor. That also means that we're creating an instance no matter if you access the property
or not. If you want to only create an instance when you access the property, you can use the ```@InjectLazy```
decorator. This will create the instance only when the property is accessed for the first time. Note that this also
works from the constructor, same as the regular ```@Inject```.  

```javascript
import {Singleton, InjectLazy} from 'decorator-dependency-injection';

@Singleton()
class Dependency {
}

class Consumer {
  @InjectLazy(Dependency) dependency // creates an instance only when the property is accessed
}
```

### Private Field Injection

Both `@Inject` and `@InjectLazy` support private fields using the `#` syntax:

```javascript
import {Singleton, Inject} from 'decorator-dependency-injection';

@Singleton()
class Database {
  query(sql) { /* ... */ }
}

class UserService {
  @Inject(Database) #db  // truly private - not accessible from outside
  
  getUser(id) {
    return this.#db.query(`SELECT * FROM users WHERE id = ${id}`)
  }
}

const service = new UserService()
service.#db  // SyntaxError: Private field '#db' must be declared
```

### The `accessor` Keyword

The `accessor` keyword (part of the TC39 decorators proposal) creates an auto-accessor - a private backing field with 
automatic getter/setter. This is particularly useful for **lazy injection with private fields**.

```javascript
class Example {
  accessor myField = 'value'
}

// Roughly equivalent to:
class Example {
  #myField = 'value'
  get myField() { return this.#myField }
  set myField(v) { this.#myField = v }
}
```

#### Using `accessor` with Injection

```javascript
import {Singleton, Inject, InjectLazy} from 'decorator-dependency-injection';

@Singleton()
class ExpensiveService {
  constructor() {
    console.log('ExpensiveService created')
  }
}

class Consumer {
  // Public accessor - works with both @Inject and @InjectLazy
  @Inject(ExpensiveService) accessor service
  
  // Private accessor - recommended for lazy private injection
  @InjectLazy(ExpensiveService) accessor #privateService
  
  doWork() {
    // Instance created only when first accessed
    return this.#privateService.process()
  }
}
```

### Injection Support Matrix

| Decorator | Syntax | Lazy? | Notes |
|-----------|--------|-------|-------|
| `@Inject` | `@Inject(Dep) field` | No | Standard injection |
| `@Inject` | `@Inject(Dep) #field` | No | Private field injection |
| `@Inject` | `@Inject(Dep) accessor field` | No* | Accessor injection |
| `@Inject` | `@Inject(Dep) accessor #field` | No* | Private accessor injection |
| `@Inject` | `@Inject(Dep) static field` | No | Static field injection |
| `@Inject` | `@Inject(Dep) static #field` | No | Static private field |
| `@Inject` | `@Inject(Dep) static accessor field` | No* | Static accessor |
| `@Inject` | `@Inject(Dep) static accessor #field` | No* | Static private accessor |
| `@InjectLazy` | `@InjectLazy(Dep) field` | ✅ Yes | Lazy public field |
| `@InjectLazy` | `@InjectLazy(Dep) #field` | ⚠️ No | See caveat below |
| `@InjectLazy` | `@InjectLazy(Dep) accessor field` | ✅ Yes | Lazy accessor |
| `@InjectLazy` | `@InjectLazy(Dep) accessor #field` | ✅ Yes | **Recommended for lazy private** |
| `@InjectLazy` | `@InjectLazy(Dep) static field` | ✅ Yes | Lazy static field |
| `@InjectLazy` | `@InjectLazy(Dep) static #field` | ⚠️ No | Same caveat as instance private |
| `@InjectLazy` | `@InjectLazy(Dep) static accessor #field` | ✅ Yes | Lazy static private accessor |

*`@Inject` with accessors caches on first access, which is similar to lazy behavior.

#### Caveat: `@InjectLazy` with Private Fields

Due to JavaScript limitations, `@InjectLazy` on private fields (`#field`) **cannot be truly lazy**. The instance is 
created at construction time (or class definition time for static fields), not on first access. This is because 
`Object.defineProperty()` cannot create getters on private fields.

This applies to both instance and static private fields.

**Recommendation:** For true lazy injection with private members, use the `accessor` keyword:

```javascript
// ❌ Not truly lazy (created at construction)
@InjectLazy(ExpensiveService) #service

// ✅ Truly lazy (created on first access)
@InjectLazy(ExpensiveService) accessor #service

// Static fields work the same way:
// ❌ Not truly lazy (created at class definition)
@InjectLazy(ExpensiveService) static #service

// ✅ Truly lazy
@InjectLazy(ExpensiveService) static accessor #service
```

### Static Field Injection

All injection decorators work with static fields. Static injections are shared across all instances of the class:

```javascript
import {Factory, Singleton, Inject} from 'decorator-dependency-injection';

@Singleton()
class SharedConfig {
  apiUrl = 'https://api.example.com'
}

@Factory()
class RequestLogger {
  static nextId = 0
  id = ++RequestLogger.nextId
}

class ApiService {
  @Inject(SharedConfig) static config  // Shared across all instances
  @Inject(RequestLogger) logger        // New instance per ApiService

  getUrl() {
    return ApiService.config.apiUrl
  }
}

const a = new ApiService()
const b = new ApiService()
console.log(a.logger.id)  // 1
console.log(b.logger.id)  // 2
console.log(ApiService.config === ApiService.config)  // true (singleton)
```

### Additional Supported Features

The injection decorators also support:

- **Computed property names**: `@Inject(Dep) [dynamicPropertyName]`
- **Symbol property names**: `@Inject(Dep) [Symbol('key')]`
- **Inheritance**: Subclasses inherit parent class injections
- **Multiple decorators**: Combine `@Inject` with other decorators
- **Nested injection**: Singletons/Factories can have their own injected dependencies

## Passing parameters to a dependency

You can pass parameters to a dependency by using the ```@Inject``` decorator with a function that returns the
dependency.

```javascript
import {Factory, Inject} from 'decorator-dependency-injection';

@Factory
class Dependency {
  constructor(param1, param2) {
    this.param1 = param1
    this.param2 = param2
  }
}

class Consumer {
  @Inject(Dependency, 'myParam', 'myOtherParam') dependency
}
```

While this is most useful for Factory dependencies, it can also be used with Singleton dependencies. However, parameters
will only be passed to the dependency the first time it is created.

## Mocking dependencies for testing

You can mock dependencies by using the ```@Mock``` decorator with a function that returns the mock dependency.

```javascript
import {Factory, Inject, Mock, resetMock} from 'decorator-dependency-injection'

@Factory()
class Dependency {
  method() {
    return 'real'
  }
}

class Consumer {
  @Inject(Dependency) dependency

  constructor() {
    console.log(this.dependency.method())
  }
}

// Test Code

@Mock(Dependency)
class MockDependency {
  method() {
    return 'mock'
  }
}

const consumer = new Consumer()  // prints 'mock'

resetMock(Dependency)

const consumer = new Consumer()  // prints 'real'
```

### Resetting Mocks

The `resetMock` utility function allows you to remove any active mock for a dependency and restore the original
implementation. This is useful for cleaning up after tests or switching between real and mock dependencies.

```javascript
import {resetMock, resetMocks} from 'decorator-dependency-injection';

resetMock(Dependency); // Restores the original Dependency implementation
resetMocks(); // Restores all mocked dependencies
```

### Clearing the Container

For complete test isolation, you can clear all registered instances from the container:

```javascript
import {clearContainer} from 'decorator-dependency-injection';

clearContainer(); // Removes all registered singletons, factories, and mocks
```

### Resolving Dependencies Without Decorators

The `resolve` function allows non-class code (plain functions, modules, callbacks, etc.) to retrieve instances from the DI container:

```javascript
import {Singleton, Factory, resolve} from 'decorator-dependency-injection';

@Singleton()
class UserService {
  getUser(id) {
    return { id, name: 'John' }
  }
}

@Factory()
class Logger {
  constructor(prefix) {
    this.prefix = prefix
  }
  log(msg) {
    console.log(`[${this.prefix}] ${msg}`)
  }
}

// Use in plain functions
function handleRequest(req) {
  const userService = resolve(UserService)
  return userService.getUser(req.userId)
}

// Use with factory parameters
function createLogger(moduleName) {
  return resolve(Logger, moduleName)
}

// Use with named registrations
const db = resolve('databaseConnection')
```

This is useful when:
- Integrating with frameworks that don't support decorators
- Writing utility functions that need DI access
- Bridging between decorator-based and non-decorator code
- Testing or debugging the container directly

### Validation Helpers

The library provides utilities to validate registrations at runtime, which is useful for catching configuration 
errors early:

#### `isRegistered(clazzOrName)`

Check if a class or name is registered:

```javascript
import {Singleton, isRegistered} from 'decorator-dependency-injection';

@Singleton()
class MyService {}

console.log(isRegistered(MyService));       // true
console.log(isRegistered('unknownName'));   // false
```

#### `validateRegistrations(...tokens)`

Validate multiple registrations at once. Throws an error with helpful details if any are missing:

```javascript
import {validateRegistrations} from 'decorator-dependency-injection';

// At application startup - fail fast if dependencies are missing
try {
  validateRegistrations(UserService, AuthService, 'databaseConnection');
} catch (err) {
  // Error: Missing registrations: [UserService, databaseConnection]. 
  //        Ensure these classes are decorated with @Singleton() or @Factory() before use.
}
```

This is particularly useful in:
- Application bootstrap to catch missing dependencies before runtime failures
- Test setup to ensure mocks are properly configured
- Module initialization to validate external dependencies

### Debug Mode

Enable debug logging to understand the injection lifecycle:

```javascript
import {setDebug} from 'decorator-dependency-injection';

setDebug(true);

// Now logs will appear when:
// - Classes are registered: [DI] Registered singleton: UserService
// - Instances are created: [DI] Creating singleton: UserService
// - Cached singletons are returned: [DI] Returning cached singleton: UserService
// - Mocks are registered: [DI] Mocked UserService with MockUserService
```

This is helpful for:
- Debugging injection order issues
- Understanding when instances are created (eager vs lazy)
- Troubleshooting circular dependencies
- Verifying test mocks are applied correctly

You can also use the ```@Mock``` decorator as a proxy instead of a full mock. Any method calls not implemented in the
mock will be passed to the real dependency.

```javascript
import {Factory, Inject, Mock, resetMock} from 'decorator-dependency-injection'

@Factory()
class Dependency {
  method() {
    return 'real'
  }

  otherMethod() {
    return 'other'
  }
}

class Consumer {
  @Inject(Dependency) dependency

  constructor() {
    console.log(this.dependency.method(), this.dependency.otherMethod())
  }
}

// Test Code

@Mock(Dependency, true)
class MockDependency {
  method() {
    return 'mock'
  }
}

const consumer = new Consumer()  // prints 'mock other'

resetMock(Dependency)

const consumer = new Consumer()  // prints 'real other'
```

For more examples, see the tests in the ```test``` directory.

## Advanced Usage

### Using Isolated Containers

For advanced scenarios like parallel test execution or module isolation, you can create separate containers:

```javascript
import {Container} from 'decorator-dependency-injection';

const container1 = new Container();
const container2 = new Container();

class MyService {}

// Register the same class in different containers
container1.registerSingleton(MyService);
container2.registerSingleton(MyService);

// Each container maintains its own singleton instance
const ctx1 = container1.getContext(MyService);
const ctx2 = container2.getContext(MyService);

const instance1 = container1.getInstance(ctx1, []);
const instance2 = container2.getInstance(ctx2, []);

console.log(instance1 === instance2); // false - different containers
```

### Accessing the Default Container

You can access the default global container for programmatic registration:

```javascript
import {getContainer} from 'decorator-dependency-injection';

const container = getContainer();
console.log(container.has(MyService)); // Check if a class is registered
```

## TypeScript Support

The library includes TypeScript definitions with helpful type aliases:

```typescript
import {Constructor, InjectionToken} from 'decorator-dependency-injection';

// Constructor<T> - a class constructor that creates instances of T
const MyClass: Constructor<MyService> = MyService;

// InjectionToken<T> - either a class or a string name
const token1: InjectionToken<MyService> = MyService;
const token2: InjectionToken = 'myServiceName';
```

All decorator functions and utilities are fully typed with generics for better autocomplete and type safety.

## Running the tests

To run the tests, run the following command in the project root.

```bash
npm test
```

## Version History

- 1.0.0 - Initial release
- 1.0.1 - Automated release with GitHub Actions
- 1.0.2 - Added proxy option to @Mock decorator
- 1.0.3 - Added @InjectLazy decorator
- 1.0.4 - Added Container abstraction, clearContainer(), TypeScript definitions, improved proxy support
- 1.0.5 - Added private field and accessor support for @Inject and @InjectLazy, debug mode, validation helpers
- 1.0.6 - Added resolve() function for non-decorator code