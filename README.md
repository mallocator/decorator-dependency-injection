# Decorator Dependency Injection
[![npm version](https://badge.fury.io/js/decorator-dependency-injection.svg)](http://badge.fury.io/js/decorator-dependency-injection)
[![Build Status](https://github.com/mallocator/decorator-dependency-injection/actions/workflows/node.js.yml/badge.svg)](https://github.com/mallocator/decorator-dependency-injection/actions/workflows/node.js.yml)


## Description

With [TC39](https://github.com/tc39/proposal-decorators) reaching stage 3 on the decorators proposal, it's time to start thinking about how we can use them in our projects. One of the most common patterns in JavaScript is dependency injection. This pattern is used to make our code more testable and maintainable. This library provides simple decorators to help you inject dependencies into your classes and mock them for testing.

## Installation

```bash
npm install decorator-dependency-injection
```

Until we reach stage 4, you will need to enable the decorators proposal in your project. You can do this by adding the following babel transpiler options to your `.babelrc` file.

```json
{
  "plugins": ["@babel/plugin-proposal-decorators"]
}
```

To run your project with decorators enabled you will need to use the babel transpiler. You can do this by running the following command in your project root.

```bash
npx babel-node index.js
```

Finally, for running tests with decorators enabled you will need to use the babel-jest package. You can do this by adding the following configuration to your `package.json` file.

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

There are 2 ways of specifying injectable dependencies: ```@Singleton``` and ```@Factory```:

### Singleton

The ```@Singleton``` decorator is used to inject a single instance of a dependency into a class. This is useful when you want to share the same instance of a class across multiple classes.

```javascript
import { Singleton } from 'decorator-dependency-injection';

@Singleton
class Dependency {}

class Consumer {
  @Inject(Dependency) dependency // creates an instance only once
}
```

### Factory

The ```@Factory``` decorator is used to inject a new instance of a dependency into a class each time it is requested. This is useful when you want to create a new instance of a class each time it is injected.

```javascript
import { Factory } from 'decorator-dependency-injection';

@Factory
class Dependency {}

class Consumer {
  @Inject(Dependency) dependency // creates a new instance each time a new Consumer is created
}
```

## Passing parameters to a dependency

You can pass parameters to a dependency by using the ```@Inject``` decorator with a function that returns the dependency.

```javascript
import { Factory, Inject } from 'decorator-dependency-injection';

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

While this is most useful for Factory dependencies, it can also be used with Singleton dependencies. However, parameters will only be passed to the dependency the first time it is created.

## Mocking dependencies for testing

You can mock dependencies by using the ```@Mock``` decorator with a function that returns the mock dependency.

```javascript
import { Factory, Inject, Mock } from 'decorator-dependency-injection'

@Factory
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

You can also use the ```@Mock``` decorator as a proxy instead of a full mock. Any method calls not implemented in the mock will be passed to the real dependency.

```javascript
import { Factory, Inject, Mock } from 'decorator-dependency-injection'

@Factory
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

## Running the tests

To run the tests, run the following command in the project root.

```bash
npm test
```

## Version History

- 1.0.0 - Initial release
- 1.0.1 - Automated release with GitHub Actions
- 1.0.2 - Added proxy option to @Mock decorator