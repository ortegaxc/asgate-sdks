/**
 * Adapters de storage para el navegador.
 */
import type { SupportedStorage } from 'asgate-js'

/** Adapter basado en `window.localStorage`. */
export function localStorageAdapter(): SupportedStorage {
  return {
    getItem: (key) =>
      typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
    setItem: (key, value) => {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(key, value)
    },
    removeItem: (key) => {
      if (typeof localStorage === 'undefined') return
      localStorage.removeItem(key)
    },
  }
}

/** Adapter basado en `window.sessionStorage` (no persiste entre pestañas). */
export function sessionStorageAdapter(): SupportedStorage {
  return {
    getItem: (key) =>
      typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key),
    setItem: (key, value) => {
      if (typeof sessionStorage === 'undefined') return
      sessionStorage.setItem(key, value)
    },
    removeItem: (key) => {
      if (typeof sessionStorage === 'undefined') return
      sessionStorage.removeItem(key)
    },
  }
}
