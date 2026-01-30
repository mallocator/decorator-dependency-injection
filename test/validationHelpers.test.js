import {
  Singleton,
  Factory,
  clearContainer,
  isRegistered,
  validateRegistrations
} from '../index.js'

describe('Validation Helpers', () => {
  afterEach(() => {
    clearContainer()
  })

  describe('isRegistered', () => {
    it('should return true for registered singleton class', () => {
      @Singleton()
      class RegisteredService {}

      expect(isRegistered(RegisteredService)).toBe(true)
    })

    it('should return true for registered factory class', () => {
      @Factory()
      class RegisteredFactory {}

      expect(isRegistered(RegisteredFactory)).toBe(true)
    })

    it('should return true for registered named singleton', () => {
      @Singleton('myService')
      class NamedService {}

      expect(isRegistered('myService')).toBe(true)
    })

    it('should return false for unregistered class', () => {
      class UnregisteredService {}

      expect(isRegistered(UnregisteredService)).toBe(false)
    })

    it('should return false for unregistered name', () => {
      expect(isRegistered('nonExistent')).toBe(false)
    })
  })

  describe('validateRegistrations', () => {
    it('should not throw when all classes are registered', () => {
      @Singleton()
      class ServiceA {}

      @Factory()
      class ServiceB {}

      @Singleton('customName')
      class ServiceC {}

      expect(() => {
        validateRegistrations(ServiceA, ServiceB, 'customName')
      }).not.toThrow()
    })

    it('should throw when a class is not registered', () => {
      @Singleton()
      class RegisteredService {}

      class UnregisteredService {}

      expect(() => {
        validateRegistrations(RegisteredService, UnregisteredService)
      }).toThrow('Missing registrations: [UnregisteredService]')
    })

    it('should throw when a named registration is missing', () => {
      @Singleton('existingName')
      class NamedService {}

      expect(() => {
        validateRegistrations('existingName', 'missingName')
      }).toThrow('Missing registrations: [missingName]')
    })

    it('should list all missing registrations in error', () => {
      class MissingA {}
      class MissingB {}

      expect(() => {
        validateRegistrations(MissingA, MissingB, 'missingName')
      }).toThrow('Missing registrations: [MissingA, MissingB, missingName]')
    })

    it('should include helpful hint in error message', () => {
      class MissingService {}

      expect(() => {
        validateRegistrations(MissingService)
      }).toThrow('@Singleton() or @Factory()')
    })

    it('should work with empty arguments', () => {
      expect(() => {
        validateRegistrations()
      }).not.toThrow()
    })
  })
})
