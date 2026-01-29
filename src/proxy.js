/**
 * Create a proxy that delegates to the mock first, then falls back to the original.
 * This allows partial mocking where only specific methods are overridden.
 *
 * @param {Object} mock The mock instance
 * @param {Object} original The original instance to fall back to
 * @returns {Proxy} A proxy that delegates appropriately
 */
export function createProxy(mock, original) {
  return new Proxy(mock, {
    get(target, prop, receiver) {
      if (prop in target) {
        return Reflect.get(target, prop, receiver)
      }
      return Reflect.get(original, prop, original)
    },

    set(target, prop, value, receiver) {
      if (prop in target) {
        return Reflect.set(target, prop, value, receiver)
      }
      return Reflect.set(original, prop, value, original)
    },

    has(target, prop) {
      return prop in target || prop in original
    },

    ownKeys(target) {
      const mockKeys = Reflect.ownKeys(target)
      const originalKeys = Reflect.ownKeys(original)
      return [...new Set([...mockKeys, ...originalKeys])]
    },

    getOwnPropertyDescriptor(target, prop) {
      if (prop in target) {
        return Reflect.getOwnPropertyDescriptor(target, prop)
      }
      return Reflect.getOwnPropertyDescriptor(original, prop)
    }
  })
}
