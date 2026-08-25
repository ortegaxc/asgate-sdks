/**
 * Modelo de sesión de la Client API (`ClientAuthViewModel`).
 *
 * El access token es un JWT de vida corta; `refreshToken` es opaco y rota en
 * cada refresh. `sessionExpiresAt` es el vencimiento duro de la sesión
 * (`expires_at` / `not_after`).
 */
import { AUTH_CONSTANTS } from './constants'
import { decodeJwtPayload, parseDate } from './helpers'
import type { AsgateUser } from './types'

export class Session {
  constructor(params: {
    accessToken: string
    refreshToken?: string | null
    tokenType?: string
    expiresIn?: number | null
    accessTokenExpiresAt?: Date | null
    sessionExpiresAt?: Date | null
    user?: AsgateUser | null
    mustChangePassword?: boolean | null
    /** Marcador de sesión por cookies httpOnly (sin tokens legibles en JS). */
    isCookieSession?: boolean
  }) {
    this.accessToken = params.accessToken
    this.refreshToken = params.refreshToken
    this.tokenType = params.tokenType ?? 'bearer'
    this.expiresIn = params.expiresIn
    this.accessTokenExpiresAt = params.accessTokenExpiresAt
    this.sessionExpiresAt = params.sessionExpiresAt
    this.user = params.user
    this.mustChangePassword = params.mustChangePassword
    this.isCookieSession = params.isCookieSession ?? false
  }

  readonly accessToken: string
  readonly refreshToken?: string | null
  readonly tokenType: string

  /** Vida del access token en segundos (tal como la devuelve la API). */
  readonly expiresIn?: number | null

  /** Momento en que expira el access token (derivado de `expires_in` o JWT `exp`). */
  readonly accessTokenExpiresAt?: Date | null

  /** Vencimiento duro de la sesión (`expires_at` / `not_after`). */
  readonly sessionExpiresAt?: Date | null

  /** Usuario asociado. Null durante una sesión aal1 pendiente de MFA. */
  readonly user?: AsgateUser | null

  readonly mustChangePassword?: boolean | null

  /** True si la sesión se gestiona por cookies httpOnly (sin tokens en JS). */
  readonly isCookieSession: boolean

  /** True si el access token está vencido o a punto de vencer (margen 30s). */
  get isExpired(): boolean {
    const at = this.accessTokenExpiresAt
    if (!at) return false
    return at.getTime() - Date.now() <= AUTH_CONSTANTS.expiryMarginMs
  }

  /** True si la sesión pasó su vencimiento duro (`not_after`). */
  get isSessionExpired(): boolean {
    const at = this.sessionExpiresAt
    if (!at) return false
    return at.getTime() <= Date.now()
  }

  private static accessTokenExpiry(
    json: Record<string, unknown>,
    now: Date = new Date(),
  ): Date | null {
    const expiresIn = json['expires_in']
    if (typeof expiresIn === 'number') {
      return new Date(now.getTime() + expiresIn * 1000)
    }
    const accessToken = json['access_token']
    if (typeof accessToken === 'string') {
      const exp = decodeJwtPayload(accessToken)['exp']
      if (typeof exp === 'number') {
        return new Date(exp * 1000)
      }
    }
    return null
  }

  /** Parsea una respuesta de la API. Devuelve null si no trae `access_token`. */
  static fromJson(
    json: Record<string, unknown>,
    now: Date = new Date(),
  ): Session | null {
    const accessToken = json['access_token']
    if (typeof accessToken !== 'string' || accessToken.length === 0) return null
    return new Session({
      accessToken,
      refreshToken: json['refresh_token'] as string | null | undefined,
      tokenType: (json['token_type'] as string | undefined) ?? 'bearer',
      expiresIn: asNullableNumber(json['expires_in']),
      accessTokenExpiresAt: Session.accessTokenExpiry(json, now),
      sessionExpiresAt: parseDate(json['expires_at']),
      user:
        json['user'] && typeof json['user'] === 'object'
          ? asUser(json['user'] as Record<string, unknown>)
          : null,
      mustChangePassword: asNullableBoolean(json['must_change_password']),
    })
  }

  toJson(): Record<string, unknown> {
    return {
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      token_type: this.tokenType,
      expires_in: this.expiresIn,
      access_token_expires_at: this.accessTokenExpiresAt?.toISOString(),
      expires_at: this.sessionExpiresAt?.toISOString(),
      user: this.user ?? null,
      must_change_password: this.mustChangePassword,
    }
  }

  /** JSON persistible de la sesión. */
  get persistSessionString(): string {
    return JSON.stringify(this.toJson())
  }

  /**
   * Extrae una sesión de una `redirect_url` OIDC
   * (`.../auth/callback#access_token=...&refresh_token=...`).
   */
  static fromOidcRedirectUrl(redirectUrl: string): Session | null {
    let fragment = ''
    try {
      fragment = redirectUrl.includes('#')
        ? redirectUrl.slice(redirectUrl.indexOf('#') + 1)
        : ''
    } catch {
      return null
    }
    const params = new URLSearchParams(fragment)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (!accessToken || accessToken.length === 0) return null

    const claims = decodeJwtPayload(accessToken)
    let accessTokenExpiresAt: Date | null = null
    const exp = claims['exp']
    if (typeof exp === 'number') {
      accessTokenExpiresAt = new Date(exp * 1000)
    }

    let user: AsgateUser | null = null
    const sub = claims['sub']
    if (typeof sub === 'string') {
      const email = claims['email']
      user = {
        id: sub,
        email: typeof email === 'string' ? email : '',
        fullName: '',
      }
    }

    return new Session({
      accessToken,
      refreshToken,
      tokenType: 'bearer',
      accessTokenExpiresAt,
      user,
    })
  }

  /** Restaura una sesión persistida. Devuelve null si el JSON es inválido. */
  static fromPersisted(jsonString: string): Session | null {
    try {
      const map = JSON.parse(jsonString)
      if (!map || typeof map !== 'object') return null
      const accessToken = (map as Record<string, unknown>)['access_token']
      if (typeof accessToken !== 'string' || accessToken.length === 0) {
        return null
      }
      const persistedExpiry = (map as Record<string, unknown>)[
        'access_token_expires_at'
      ]
      return new Session({
        accessToken,
        refreshToken: (map as Record<string, unknown>)['refresh_token'] as
          | string
          | null
          | undefined,
        tokenType:
          ((map as Record<string, unknown>)['token_type'] as string) ??
          'bearer',
        expiresIn: asNullableNumber(
          (map as Record<string, unknown>)['expires_in'],
        ),
        accessTokenExpiresAt:
          typeof persistedExpiry === 'string'
            ? parseDate(persistedExpiry)
            : Session.accessTokenExpiry(map as Record<string, unknown>),
        sessionExpiresAt: parseDate(
          (map as Record<string, unknown>)['expires_at'],
        ),
        user:
          (map as Record<string, unknown>)['user'] &&
          typeof (map as Record<string, unknown>)['user'] === 'object'
            ? asUser(
                (map as Record<string, unknown>)['user'] as Record<
                  string,
                  unknown
                >,
              )
            : null,
        mustChangePassword: asNullableBoolean(
          (map as Record<string, unknown>)['must_change_password'],
        ),
      })
    } catch {
      return null
    }
  }

  /** Sesión marcadora para el modo de entrega por cookies httpOnly. */
  static cookieSession(): Session {
    return new Session({
      accessToken: '',
      refreshToken: null,
      tokenType: 'bearer',
      isCookieSession: true,
    })
  }

  copyWith(params: Partial<Session>): Session {
    return new Session({
      accessToken: params.accessToken ?? this.accessToken,
      refreshToken: params.refreshToken !== undefined ? params.refreshToken : this.refreshToken,
      tokenType: params.tokenType ?? this.tokenType,
      expiresIn: params.expiresIn !== undefined ? params.expiresIn : this.expiresIn,
      accessTokenExpiresAt:
        params.accessTokenExpiresAt !== undefined
          ? params.accessTokenExpiresAt
          : this.accessTokenExpiresAt,
      sessionExpiresAt:
        params.sessionExpiresAt !== undefined
          ? params.sessionExpiresAt
          : this.sessionExpiresAt,
      user: params.user !== undefined ? params.user : this.user,
      mustChangePassword:
        params.mustChangePassword !== undefined
          ? params.mustChangePassword
          : this.mustChangePassword,
      isCookieSession: params.isCookieSession ?? this.isCookieSession,
    })
  }

  toString(): string {
    const short = this.accessToken.slice(0, Math.min(8, this.accessToken.length))
    return `Session(accessToken: ${short}..., expiresIn: ${this.expiresIn ?? 'null'}, user: ${this.user?.email ?? 'null'})`
  }
}

// ─── Helpers de parseo ────────────────────────────────────────────────────

function asNullableNumber(value: unknown): number | null | undefined {
  return typeof value === 'number' ? value : value === null ? null : undefined
}

function asNullableBoolean(value: unknown): boolean | null | undefined {
  return typeof value === 'boolean' ? value : value === null ? null : undefined
}

/** Perfil mínimo del usuario final en respuestas de auth (`ClientAuthUser`). */
export function asUser(json: Record<string, unknown>): AsgateUser {
  return {
    id: asString(json['id']),
    email: asString(json['email']),
    fullName: asString(json['full_name']),
  }
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
