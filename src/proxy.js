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
      return prop in target
        ? Reflect.get(target, prop, receiver)
        : Reflect.get(original, prop, original)
    },

    set(target, prop, value, receiver) {
      return prop in target
        ? Reflect.set(target, prop, value, receiver)
        : Reflect.set(original, prop, value, original)
    },

    has(target, prop) {
      return prop in target || prop in original
    },

    ownKeys(target) {
      return [...new Set([...Reflect.ownKeys(target), ...Reflect.ownKeys(original)])]
    },

    getOwnPropertyDescriptor(target, prop) {
      return prop in target
        ? Reflect.getOwnPropertyDescriptor(target, prop)
        : Reflect.getOwnPropertyDescriptor(original, prop)
    },

    getPrototypeOf() {
      // Return original's prototype so instanceof checks work
      return Object.getPrototypeOf(original)
    }
  })
}
