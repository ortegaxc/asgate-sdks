import { describe, expect, it } from 'vitest'
import { createClient } from '../src/asgate-client'
import { fakeJwt, createMockFetch } from './helpers'

function envelope(data: unknown) {
  return { status_code: 200, message: 'ok', data }
}

describe('AsgateOAuthApi', () => {
  it('getOidcSignInUrl devuelve provider y authorize_url con slug header', async () => {
    const { fetchImpl, calls } = createMockFetch((url) => {
      if (url.endsWith('/api/v1/auth/oidc/start')) {
        return {
          status: 200,
          body: envelope({
            provider: 'oidc_custom',
            authorize_url: 'https://idp.example.com/authorize?client_id=x',
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
    const res = await client.oauth.getOidcSignInUrl()
    expect(res.provider).toBe('oidc_custom')
    expect(res.authorizeUrl).toContain('https://idp.example.com')
    const call = calls.find((c) => c.url.endsWith('/api/v1/auth/oidc/start'))
    const headers = call?.init.headers as Record<string, string>
    expect(headers['X-Organization-Slug']).toBe('acme')
  })

  it('handleOidcCallback intercambia code/state y guarda sesión', async () => {
    const accessToken = fakeJwt({ sub: 'u1', email: 'a@b.c', exp: 2000000000 })
    const { fetchImpl } = createMockFetch((url) => {
      if (url.includes('/api/v1/auth/oidc/callback')) {
        return {
          status: 200,
          body: envelope({
            redirect_url: `https://app/auth/callback#access_token=${accessToken}&refresh_token=ref`,
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
    const res = await client.oauth.handleOidcCallback(
      'https://app/auth/callback?code=abc&state=xyz',
    )
    expect(res.session?.refreshToken).toBe('ref')
    expect(res.session?.user?.id).toBe('u1')
    expect(client.isSignedIn).toBe(true)
  })

  it('handleOidcCallback lanza si falta code o state', async () => {
    const { fetchImpl } = createMockFetch(() => ({ status: 200, body: {} }))
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    await expect(
      client.oauth.handleOidcCallback('https://app/auth/callback?code=abc'),
    ).rejects.toThrow('missing code or state')
  })

  it('handleOidcCallback lanza si el query trae error', async () => {
    const { fetchImpl } = createMockFetch(() => ({ status: 200, body: {} }))
    const client = createClient({
      url: 'http://localhost:4440',
      organizationSlug: 'acme',
      fetch: fetchImpl,
    })
    await expect(
      client.oauth.handleOidcCallback(
        'https://app/auth/callback?error=access_denied',
      ),
    ).rejects.toThrow('OAuth error: access_denied')
  })
})
