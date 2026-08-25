import { describe, expect, it } from 'vitest'
import { Session } from '../src/lib/session'
import { fakeJwt } from './helpers'

describe('Session', () => {
  it('parsea desde JSON con expires_in', () => {
    const session = Session.fromJson(
      {
        access_token: 'tok',
        refresh_token: 'ref',
        token_type: 'bearer',
        expires_in: 3600,
      },
      new Date('2026-01-01T00:00:00Z'),
    )
    expect(session?.accessToken).toBe('tok')
    expect(session?.refreshToken).toBe('ref')
    expect(session?.tokenType).toBe('bearer')
    expect(session?.accessTokenExpiresAt?.toISOString()).toBe(
      '2026-01-01T01:00:00.000Z',
    )
  })

  it('devuelve null sin access_token', () => {
    expect(Session.fromJson({})).toBeNull()
    expect(Session.fromJson({ refresh_token: 'ref' })).toBeNull()
  })

  it('deriva accessTokenExpiresAt del JWT exp', () => {
    const session = Session.fromJson(
      { access_token: fakeJwt({ exp: 2000000000 }) },
      new Date('2026-01-01T00:00:00Z'),
    )
    expect(session?.accessTokenExpiresAt?.toISOString()).toBe(
      '2033-05-18T03:33:20.000Z',
    )
  })

  it('parsea must_change_password y expires_at', () => {
    const session = Session.fromJson({
      access_token: 'tok',
      must_change_password: true,
      expires_at: '2026-01-02T00:00:00Z',
    })
    expect(session?.mustChangePassword).toBe(true)
    expect(session?.sessionExpiresAt?.toISOString()).toBe(
      '2026-01-02T00:00:00.000Z',
    )
  })

  it('round-trip persist/restore', () => {
    const s = Session.fromJson({
      access_token: 'tok',
      refresh_token: 'ref',
      expires_in: 60,
      user: { id: '1', email: 'a@b.c', full_name: 'A' },
    })
    expect(s).not.toBeNull()
    const restored = Session.fromPersisted(s!.persistSessionString)
    expect(restored?.accessToken).toBe('tok')
    expect(restored?.refreshToken).toBe('ref')
    expect(restored?.user?.email).toBe('a@b.c')
  })

  it('fromPersisted devuelve null con JSON inválido', () => {
    expect(Session.fromPersisted('not-json')).toBeNull()
    expect(Session.fromPersisted('{}')).toBeNull()
  })

  it('isExpired aplica margen de 30s', () => {
    const now = Date.now()
    const near = new Session({
      accessToken: 'tok',
      accessTokenExpiresAt: new Date(now + 10_000),
    })
    expect(near.isExpired).toBe(true)
    const far = new Session({
      accessToken: 'tok',
      accessTokenExpiresAt: new Date(now + 60_000),
    })
    expect(far.isExpired).toBe(false)
  })

  it('isSessionExpired usa el vencimiento duro', () => {
    const s = new Session({
      accessToken: 'tok',
      sessionExpiresAt: new Date(Date.now() - 1000),
    })
    expect(s.isSessionExpired).toBe(true)
    const s2 = new Session({
      accessToken: 'tok',
      sessionExpiresAt: new Date(Date.now() + 60_000),
    })
    expect(s2.isSessionExpired).toBe(false)
  })

  it('fromOidcRedirectUrl parsea los tokens del fragment', () => {
    const accessToken = fakeJwt({
      sub: 'u1',
      email: 'a@b.c',
      exp: 2000000000,
    })
    const url = `https://app/auth/callback#access_token=${accessToken}&refresh_token=ref`
    const s = Session.fromOidcRedirectUrl(url)
    expect(s?.accessToken).toBe(accessToken)
    expect(s?.refreshToken).toBe('ref')
    expect(s?.user?.id).toBe('u1')
    expect(s?.user?.email).toBe('a@b.c')
  })

  it('fromOidcRedirectUrl devuelve null sin tokens', () => {
    expect(Session.fromOidcRedirectUrl('https://app/#error=denied')).toBeNull()
  })

  it('cookieSession marca sesión por cookies', () => {
    const s = Session.cookieSession()
    expect(s.isCookieSession).toBe(true)
    expect(s.isExpired).toBe(false)
  })
})
