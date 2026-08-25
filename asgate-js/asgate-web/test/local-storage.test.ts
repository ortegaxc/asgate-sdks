import { afterEach, describe, expect, it } from 'vitest'
import { localStorageAdapter, sessionStorageAdapter } from '../src/local-storage'
import { createBrowserClient } from '../src/browser-client'

function mockFetch(body: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
}

class FakeStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
  get entries(): Map<string, string> {
    return this.store
  }
}

describe('asgate-web', () => {
  const originalLocal = globalThis.localStorage
  const originalSession = globalThis.sessionStorage

  afterEach(() => {
    if (originalLocal === undefined) {
      // @ts-expect-error limpieza de test
      delete globalThis.localStorage
    } else {
      globalThis.localStorage = originalLocal
    }
    if (originalSession === undefined) {
      // @ts-expect-error limpieza de test
      delete globalThis.sessionStorage
    } else {
      globalThis.sessionStorage = originalSession
    }
  })

  it('localStorageAdapter persiste y lee', () => {
    const storage = new FakeStorage()
    globalThis.localStorage = storage as unknown as Storage
    const adapter = localStorageAdapter()
    adapter.setItem('k', 'v')
    expect(adapter.getItem('k')).toBe('v')
    adapter.removeItem('k')
    expect(adapter.getItem('k')).toBeNull()
  })

  it('sessionStorageAdapter usa sessionStorage', () => {
    const storage = new FakeStorage()
    globalThis.sessionStorage = storage as unknown as Storage
    const adapter = sessionStorageAdapter()
    adapter.setItem('k', 'v')
    expect(adapter.getItem('k')).toBe('v')
  })

  it('createBrowserClient persiste la sesión en localStorage', async () => {
    const storage = new FakeStorage()
    globalThis.localStorage = storage as unknown as Storage
    const client = createBrowserClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: mockFetch({
        status_code: 200,
        message: 'ok',
        data: {
          access_token: 'tok',
          refresh_token: 'ref',
          expires_in: 3600,
          user: { id: '1', email: 'a@b.c', full_name: 'A' },
        },
      }),
    })
    await client.signInWithPassword({ email: 'a@b.c', password: 'x' })
    expect(client.isSignedIn).toBe(true)

    let found = false
    for (const value of storage.entries.values()) {
      if (value.includes('"access_token":"tok"')) found = true
    }
    expect(found).toBe(true)
  })
})
