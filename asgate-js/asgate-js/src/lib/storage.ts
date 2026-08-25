/**
 * Persistencia de la sesión (JSON completo).
 *
 * El core solo persiste/lee la cadena JSON de la sesión bajo una clave.
 * La implementación concreta del adapter la provee el consumidor
 * (p. ej. `localStorage` en el navegador vía `asgate-web`, o `InMemoryStorage`).
 */

/** Adapter de almacenamiento (síncrono o asíncrono), espejo de `SupportedStorage`. */
export interface SupportedStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

/** Storage en memoria (tests / sin persistencia). */
export function memoryLocalStorageAdapter(): SupportedStorage {
  const store: Record<string, string> = {}
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = value
    },
    removeItem: (key) => {
      delete store[key]
    },
  }
}

/** Storage en memoria con una instancia propia (espejo de `InMemoryAuthStorage`). */
export class InMemoryStorage implements SupportedStorage {
  private readonly store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }
}

/** Storage en memoria que emula persistencia por clave de sesión. */
export class SessionMemoryStorage {
  static readonly sessionKey = 'asgate.session'

  private readonly store = new Map<string, string>()

  async initialize(): Promise<void> {
    /* no-op */
  }

  async hasSession(): Promise<boolean> {
    return this.store.has(SessionMemoryStorage.sessionKey)
  }

  async loadSession(): Promise<string | null> {
    return this.store.get(SessionMemoryStorage.sessionKey) ?? null
  }

  async persistSession(persistSessionString: string): Promise<void> {
    this.store.set(SessionMemoryStorage.sessionKey, persistSessionString)
  }

  async removeSession(): Promise<void> {
    this.store.delete(SessionMemoryStorage.sessionKey)
  }
}
