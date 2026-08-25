import { describe, expect, it, vi } from 'vitest'
import { AsgateClient, createClient } from '../src/asgate-client'
import {
  AsgateApiException,
  AsgateInvalidRefreshTokenException,
} from '../src/lib/errors'
import { memoryLocalStorageAdapter } from '../src/lib/storage'
import { fakeJwt, createMockFetch } from './helpers'

function envelope(data: unknown, status = 200, message = 'ok') {
  return { status_code: status, message, data }
}

describe('AsgateClient', () => {
  it('signInWithPassword guarda sesión, emite signedIn y envía headers', async () => {
    const events: string[] = []
    const { fetchImpl, calls } = createMockFetch((url) => {
      if (url.endsWith('/api/v1/auth/login')) {
        return {
          status: 200,
          body: envelope({
            access_token: 'tok',
            refresh_token: 'ref',
            expires_in: 3600,
            user: { id: '1', email: 'a@b.c', full_name: 'A' },
          }),
        }
      }
      return { status: 404, body: {} }
    })
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    client.onAuthStateChange((event) => events.push(event))

    const res = await client.signInWithPassword({
      email: 'a@b.c',
      password: 'secret',
    })

    expect(res.session?.accessToken).toBe('tok')
    expect(client.isSignedIn).toBe(true)
    expect(client.accessToken).toBe('tok')
    expect(events).toContain('signedIn')

    const loginCall = calls.find((c) => c.url.endsWith('/api/v1/auth/login'))
    const headers = loginCall?.init.headers as Record<string, string>
    expect(headers['X-Organization-Slug']).toBe('acme')
    expect(headers['X-Auth-Delivery']).toBe('bearer')
  })

  it('mapea el error de login a AsgateApiException con code', async () => {
    const { fetchImpl } = createMockFetch(() => ({
      status: 401,
      body: {
        status_code: 401,
        error: {
          code: 'CLG001_INVALID_CREDENTIALS',
          userMessage: 'Credenciales inválidas',
        },
      },
    }))
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    try {
      await client.signInWithPassword({ email: 'a@b.c', password: 'bad' })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(AsgateApiException)
      const api = e as AsgateApiException
      expect(api.isInvalidCredentials).toBe(true)
      expect(api.userMessage).toBe('Credenciales inválidas')
    }
  })

  it('signUp con confirmación requerida no emite sesión', async () => {
    const events: string[] = []
    const { fetchImpl } = createMockFetch((url) => {
      if (url.endsWith('/api/v1/auth/signup')) {
        return {
          status: 200,
          body: envelope({
            email_confirmation_required: true,
            phone_confirmation_required: false,
            user: { id: '1', email: 'a@b.c', full_name: 'A' },
          }),
        }
      }
      return { status: 404, body: {} }
    })
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    client.onAuthStateChange((event) => events.push(event))
    const res = await client.signUp({
      email: 'a@b.c',
      password: 'secret',
      fullName: 'A',
    })
    expect(res.requiresConfirmation).toBe(true)
    expect(res.session).toBeNull()
    expect(client.isSignedIn).toBe(false)
    expect(events).not.toContain('signedIn')
  })

  it('login mfa_required mantiene sesión aal1 y expone factores', async () => {
    const { fetchImpl } = createMockFetch(() => ({
      status: 200,
      body: envelope({
        mfa_required: true,
        factors: [
          { id: 'f1', factor_type: 'totp', status: 'verified' },
          { id: 'f2', factor_type: 'sms', status: 'unverified' },
        ],
        access_token: fakeJwt({ exp: 2000000000 }),
        refresh_token: 'ref-aal1',
        expires_in: 3600,
      }),
    }))
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    const res = await client.signInWithPassword({
      email: 'a@b.c',
      password: 'secret',
    })
    expect(res.isMfaRequired).toBe(true)
    expect(res.mfaRequired?.factors.map((f) => f.id)).toEqual(['f1', 'f2'])
    expect(res.mfaRequired?.factors[0]?.isVerified).toBe(true)
    expect(client.isSignedIn).toBe(true)
  })

  it('refreshSession deduplica llamadas concurrentes', async () => {
    let refreshCalls = 0
    const { fetchImpl } = createMockFetch((url) => {
      if (url.endsWith('/api/v1/auth/login')) {
        return {
          status: 200,
          body: envelope({
            access_token: 'tok',
            refresh_token: 'ref',
            expires_in: 3600,
          }),
        }
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls++
        return {
          status: 200,
          body: envelope({
            access_token: 'tok2',
            refresh_token: 'ref2',
            expires_in: 3600,
          }),
        }
      }
      return { status: 404, body: {} }
    })
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    await client.signInWithPassword({ email: 'a@b.c', password: 'secret' })
    const [r1, r2] = await Promise.all([
      client.refreshSession(),
      client.refreshSession(),
    ])
    expect(refreshCalls).toBe(1)
    expect(r1.session?.accessToken).toBe('tok2')
    expect(r2.session?.accessToken).toBe('tok2')
  })

  it('refresh con token reusado limpia la sesión y emite signedOut', async () => {
    const events: string[] = []
    const { fetchImpl } = createMockFetch((url) => {
      if (url.endsWith('/api/v1/auth/login')) {
        return {
          status: 200,
          body: envelope({
            access_token: 'tok',
            refresh_token: 'ref',
            expires_in: 3600,
          }),
        }
      }
      if (url.endsWith('/api/v1/auth/refresh')) {
        return {
          status: 401,
          body: {
            status_code: 401,
            error: {
              code: 'CLR001_REFRESH_TOKEN_REUSED',
              userMessage: 'Sesión revocada',
            },
          },
        }
      }
      return { status: 404, body: {} }
    })
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    client.onAuthStateChange((event) => events.push(event))
    await client.signInWithPassword({ email: 'a@b.c', password: 'secret' })
    await expect(client.refreshSession()).rejects.toBeInstanceOf(AsgateApiException)
    expect(client.isSignedIn).toBe(false)
    expect(events).toContain('signedOut')
  })

  it('initialize restaura sesión persistida del storage', async () => {
    const storage = memoryLocalStorageAdapter()
    const events: string[] = []
    const { fetchImpl } = createMockFetch(() => ({
      status: 200,
      body: envelope({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_in: 3600,
        user: { id: '1', email: 'a@b.c', full_name: 'A' },
      }),
    }))
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
      storage,
    })
    await client.signInWithPassword({ email: 'a@b.c', password: 'secret' })
    client.dispose()

    const client2 = new AsgateClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
      storage,
    })
    client2.onAuthStateChange((event) => events.push(event))
    await client2.initialize()
    expect(client2.isSignedIn).toBe(true)
    expect(client2.currentUser?.email).toBe('a@b.c')
    expect(events).toContain('initialSession')
  })

  it('getMe emite userUpdated', async () => {
    const events: string[] = []
    const { fetchImpl } = createMockFetch(() => ({
      status: 200,
      body: envelope({
        id: '1',
        email: 'a@b.c',
        full_name: 'A',
        email_verified: true,
        roles: ['admin'],
        organization: { id: 'org1', name: 'Acme', slug: 'acme' },
      }),
    }))
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    client.onAuthStateChange((event) => events.push(event))
    await client.signInWithPassword({ email: 'a@b.c', password: 'x' })
    const me = await client.getMe()
    expect(me.email).toBe('a@b.c')
    expect(me.organization.slug).toBe('acme')
    expect(events).toContain('userUpdated')
  })

  it('refreshSession sin sesión lanza AsgateInvalidRefreshTokenException', async () => {
    const { fetchImpl } = createMockFetch(() => ({ status: 404, body: {} }))
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    await expect(client.refreshSession()).rejects.toBeInstanceOf(
      AsgateInvalidRefreshTokenException,
    )
  })

  it('signOut revoca y limpia la sesión', async () => {
    const events: string[] = []
    let logoutCalls = 0
    const { fetchImpl } = createMockFetch((url) => {
      if (url.endsWith('/api/v1/auth/login')) {
        return {
          status: 200,
          body: envelope({
            access_token: 'tok',
            refresh_token: 'ref',
            expires_in: 3600,
          }),
        }
      }
      if (url.includes('/api/v1/auth/logout')) {
        logoutCalls++
        return { status: 200, body: envelope({}) }
      }
      return { status: 404, body: {} }
    })
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    client.onAuthStateChange((event) => events.push(event))
    await client.signInWithPassword({ email: 'a@b.c', password: 'x' })
    await client.signOut()
    expect(logoutCalls).toBe(1)
    expect(client.isSignedIn).toBe(false)
    expect(events).toContain('signedOut')
  })

  it('modo cookie no envía X-Auth-Delivery y marca sesión', async () => {
    const { fetchImpl, calls } = createMockFetch((url) => {
      if (url.endsWith('/api/v1/auth/login')) {
        return { status: 200, body: envelope({ message: 'Login exitoso' }) }
      }
      return { status: 404, body: {} }
    })
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
      delivery: 'cookie',
    })
    const res = await client.signInWithPassword({
      email: 'a@b.c',
      password: 'x',
    })
    const loginCall = calls.find((c) => c.url.endsWith('/api/v1/auth/login'))
    const headers = loginCall?.init.headers as Record<string, string>
    expect(headers['X-Auth-Delivery']).toBeUndefined()
    expect(loginCall?.init.credentials).toBe('include')
    expect(res.session?.isCookieSession).toBe(true)
    expect(client.isSignedIn).toBe(true)
  })

  it('los timers de auto-refresh se limpian al hacer dispose', () => {
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: vi.fn() as unknown as typeof fetch,
    })
    client.startAutoRefresh()
    client.dispose()
    expect(client.currentSession).toBeNull()
  })

  it('onAuthStateChange replaya el último estado a suscriptores tardíos', async () => {
    const { fetchImpl } = createMockFetch(() => ({
      status: 200,
      body: envelope({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_in: 3600,
      }),
    }))
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    await client.signInWithPassword({ email: 'a@b.c', password: 'x' })

    const late: string[] = []
    client.onAuthStateChange((event) => late.push(event))
    expect(late).toEqual(['signedIn'])
  })

  it('onAuthStateChange no replaya si aún no hubo evento', () => {
    const { fetchImpl } = createMockFetch(() => ({ status: 200, body: {} }))
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    const events: string[] = []
    client.onAuthStateChange((event) => events.push(event))
    expect(events).toEqual([])
  })

  it('notifyError invoca el onError del suscriptor', () => {
    const { fetchImpl } = createMockFetch(() => ({ status: 200, body: {} }))
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    const errors: string[] = []
    const err = new Error('boom')
    client.onAuthStateChange(() => {}, (error) => errors.push(String(error)))
    client.notifyError(err)
    expect(errors).toEqual(['Error: boom'])
  })
})
