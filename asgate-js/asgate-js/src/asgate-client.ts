/**
 * Cliente de autenticación de la Client API v3 de asgate (ms-auth).
 *
 * Espejo del SDK Dart `AsgateClient`:
 *
 * ```ts
 * const client = createClient({
 *   url: 'http://localhost:4440',
 *   organizationSlug: 'my-org',
 * })
 * await client.initialize()
 * await client.signInWithPassword({ email, password })
 * ```
 */
import { AsgateMFAApi } from './auth/mfa-api'
import { AsgateOAuthApi } from './auth/oauth-api'
import { AUTH_CONSTANTS } from './lib/constants'
import {
  AsgateException,
  AsgateInvalidRefreshTokenException,
  AsgateRetryableException,
  AsgateApiException,
} from './lib/errors'
import { AsgateFetch, type RequestOptions } from './lib/fetch'
import { defaultPersistSessionKey, normalizeUrl } from './lib/helpers'
import {
  parseAuthResponse,
  parseMe,
  parsePasswordPolicy,
  parseSignupResponse,
} from './lib/parsers'
import { Session } from './lib/session'
import {
  memoryLocalStorageAdapter,
  type SupportedStorage,
} from './lib/storage'
import type {
  AsgateClientOptions,
  AsgateUser,
  AuthChangeEvent,
  AuthResponse,
  AuthSubscription,
  Me,
  PasswordPolicy,
  SignOutScope,
  SignupResponse,
  TokenDelivery,
  VerificationType,
} from './lib/types'

const DEFAULT_EXPIRY_MARGIN_MS = AUTH_CONSTANTS.expiryMarginMs

type RequestMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

/** Opciones internas de `_request` (usadas por los sub-APIs). */
export interface InternalRequestOptions {
  authenticated?: boolean
  sendReauthentication?: boolean
  query?: Record<string, string>
  body?: Record<string, unknown> | null
}

/** Listener de estado de autenticación (evento + error opcional). */
interface AuthStateListener {
  onEvent: (event: AuthChangeEvent, session: Session | null) => void
  onError?: (error: unknown) => void
}

export class AsgateClient {
  constructor(options: AsgateClientOptions) {
    this._baseUrl = normalizeUrl(options.url)
    this._organizationSlug = options.organizationSlug
    this._headers = options.headers ?? {}
    this._delivery = options.delivery ?? 'bearer'
    this._autoRefreshToken =
      (options.autoRefreshToken ?? true) && this._delivery === 'bearer'
    this._storage = options.storage ?? memoryLocalStorageAdapter()
    this._storageKey =
      options.storageKey ?? defaultPersistSessionKey(this._baseUrl, this._organizationSlug)
    this._fetch = new AsgateFetch({ fetch: options.fetch })
    this._sessionVersion = 0
  }

  // ─── Estado interno ─────────────────────────────────────────────────────

  private readonly _baseUrl: string
  private readonly _organizationSlug: string
  private readonly _headers: Record<string, string>
  private readonly _delivery: TokenDelivery
  private readonly _autoRefreshToken: boolean
  private readonly _storage: SupportedStorage
  private readonly _storageKey: string
  private readonly _fetch: AsgateFetch

  private _currentSession: Session | null = null
  private _reauthenticationToken: string | null = null

  /** Contador de versión de sesión: evita que un refresh en vuelo pise una
   *  sesión más nueva (sign-in/sign-out ocurridos mientras tanto). */
  private _sessionVersion: number

  private readonly _pendingRefreshes = new Map<string, Promise<AuthResponse>>()

  private _autoRefreshTicker: ReturnType<typeof setTimeout> | null = null

  private _listeners = new Set<AuthStateListener>()

  /** Último evento emitido (para replay a suscriptores tardíos, como ReplaySubject). */
  private _lastEvent: AuthChangeEvent | null = null

  private _mfa?: AsgateMFAApi
  private _oauth?: AsgateOAuthApi

  // ─── Getters públicos ───────────────────────────────────────────────────

  /** URL base normalizada. */
  get url(): string {
    return this._baseUrl
  }

  /** Slug de la organización/tenant. */
  get organizationSlug(): string {
    return this._organizationSlug
  }

  /** Modo de entrega de tokens. */
  get delivery(): TokenDelivery {
    return this._delivery
  }

  /** Sesión actual (access + refresh tokens). */
  get currentSession(): Session | null {
    return this._currentSession
  }

  /** Usuario actual (null durante una sesión aal1 pendiente de MFA). */
  get currentUser(): AsgateUser | null {
    return this._currentSession?.user ?? null
  }

  get isSignedIn(): boolean {
    return this._currentSession !== null
  }

  get accessToken(): string | null {
    return this._currentSession?.accessToken ?? null
  }

  get refreshToken(): string | null {
    return this._currentSession?.refreshToken ?? null
  }

  /** Namespace MFA. */
  get mfa(): AsgateMFAApi {
    return (this._mfa ??= new AsgateMFAApi(this))
  }

  /** Namespace OAuth/OIDC custom. */
  get oauth(): AsgateOAuthApi {
    return (this._oauth ??= new AsgateOAuthApi(this))
  }

  // ─── Inicialización / restauración ──────────────────────────────────────

  /**
   * Restaura la sesión persistida (si existe). No lanza: si la restauración
   * falla, la sesión se limpia y se emite `signedOut`.
   */
  async initialize(): Promise<void> {
    const jsonString = await this._storage.getItem(this._storageKey)
    if (jsonString && jsonString.length > 0) {
      try {
        await this.recoverSession(jsonString)
      } catch {
        // Ya se notificó el estado correspondiente.
      }
    } else {
      this._notifyAllSubscribers('initialSession')
    }
  }

  /**
   * Restaura una sesión persistida, refrescándola si el access token venció.
   */
  async recoverSession(jsonString: string): Promise<AuthResponse> {
    const session = Session.fromPersisted(jsonString)
    if (session === null) {
      await this._removeSession('signedOut')
      throw new AsgateException('Invalid persisted session')
    }
    if (session.isExpired) {
      const token = session.refreshToken
      if (token && !session.isSessionExpired) {
        return this._callRefreshToken(token)
      }
      await this._removeSession('signedOut')
      throw new AsgateException('Session has expired')
    }
    await this._saveSession(session, 'initialSession')
    return { session, user: session.user ?? null, mfaRequired: null, isMfaRequired: false }
  }

  // ─── Sesión ─────────────────────────────────────────────────────────────

  /** Inicia sesión con email + contraseña. */
  async signInWithPassword(params: {
    email: string
    password: string
  }): Promise<AuthResponse> {
    const json = await this._request(AUTH_CONSTANTS.pathLogin, 'post', {
      body: { email: params.email, password: params.password },
    })
    return this._applyAuthResponse(this._dataMap(json))
  }

  /** Registra un usuario final. */
  async signUp(params: {
    email?: string
    phone?: string
    password: string
    fullName?: string
  }): Promise<SignupResponse> {
    const json = await this._request(AUTH_CONSTANTS.pathSignup, 'post', {
      body: {
        password: params.password,
        ...(params.email !== undefined ? { email: params.email } : {}),
        ...(params.phone !== undefined ? { phone: params.phone } : {}),
        ...(params.fullName !== undefined ? { full_name: params.fullName } : {}),
      },
    })
    const response = parseSignupResponse(this._dataMap(json))
    if (response.session) {
      await this._saveSession(response.session, 'signedIn')
    }
    return response
  }

  /** Renueva el access token (usa el refresh token actual si no se pasa uno). */
  refreshSession(refreshToken?: string): Promise<AuthResponse> {
    return this._callRefreshToken(refreshToken)
  }

  /** Devuelve la sesión actual; si el access token venció, refresca primero. */
  async getSession(): Promise<Session | null> {
    const session = this._currentSession
    if (session === null) return null
    if (session.isCookieSession) return session
    if (session.isExpired) {
      const refreshed = await this._callRefreshToken(session.refreshToken)
      return refreshed.session
    }
    return session
  }

  /** Establece una sesión a partir de un refresh token. */
  setSession(refreshToken: string): Promise<AuthResponse> {
    return this._callRefreshToken(refreshToken)
  }

  /**
   * Establece una sesión directamente a partir de un access token (y refresh
   * opcional). Útil para restaurar sesiones desde un fragment OIDC u otro
   * mecanismo que entregue tokens en JS.
   */
  async setSessionFromTokens(params: {
    accessToken: string
    refreshToken?: string | null
  }): Promise<void> {
    const session = new Session({
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
    })
    await this._saveSession(session, 'signedIn')
  }

  /**
   * Restaura una sesión desde una URL de callback OIDC
   * (`.../auth/callback#access_token=...&refresh_token=...`).
   * Devuelve `true` si encontró tokens en el fragment.
   */
  async setSessionFromOidcUrl(redirectUrl: string): Promise<boolean> {
    const session = Session.fromOidcRedirectUrl(redirectUrl)
    if (session === null) return false
    await this._saveSession(session, 'signedIn')
    return true
  }

  /** Cierra sesión (revoca en el backend según `scope` y limpia localmente). */
  async signOut(params: { scope?: SignOutScope } = {}): Promise<void> {
    const scope = params.scope ?? 'local'
    if (this._currentSession !== null) {
      try {
        await this._request(AUTH_CONSTANTS.pathLogout, 'post', {
          authenticated: true,
          query: { scope },
        })
      } catch {
        // Se ignora: la sesión local se limpia igual.
      }
    }
    await this._removeSession('signedOut')
  }

  // ─── Perfil ─────────────────────────────────────────────────────────────

  /** Obtiene el perfil completo del usuario (`GET /api/v1/auth/me`). */
  async getMe(): Promise<Me> {
    const json = await this._request(AUTH_CONSTANTS.pathMe, 'get', {
      authenticated: true,
    })
    const me = parseMe(this._dataMap(json))
    this._notifyAllSubscribers('userUpdated')
    return me
  }

  // ─── Verificación de email / teléfono ───────────────────────────────────

  /** Verifica el email con el OTP (`email_verification`). */
  async verifyEmail(params: { token: string }): Promise<AuthResponse> {
    const json = await this._request(AUTH_CONSTANTS.pathVerifyEmail, 'post', {
      body: { token: params.token },
    })
    return this._applyAuthResponse(this._dataMap(json))
  }

  /** Verifica el teléfono con el OTP SMS. */
  async verifyPhone(params: { code: string; phone?: string }): Promise<boolean> {
    const json = await this._request(AUTH_CONSTANTS.pathVerifyPhone, 'post', {
      body: {
        code: params.code,
        ...(params.phone !== undefined ? { phone: params.phone } : {}),
      },
    })
    return this._dataMap(json)['verified'] === true
  }

  /** Reenvía el código de verificación (anti-enumeración: siempre 200). */
  async resendVerification(params: {
    type?: VerificationType
    email?: string
    phone?: string
  }): Promise<boolean> {
    const type = params.type ?? 'email'
    const json = await this._request(
      AUTH_CONSTANTS.pathResendVerification,
      'post',
      {
        body: {
          type,
          ...(params.email !== undefined ? { email: params.email } : {}),
          ...(params.phone !== undefined ? { phone: params.phone } : {}),
        },
      },
    )
    return this._dataMap(json)['sent'] === true
  }

  // ─── Contraseña y email ─────────────────────────────────────────────────

  /** Política de contraseñas de la organización. */
  async getPasswordPolicy(): Promise<PasswordPolicy> {
    const json = await this._request(AUTH_CONSTANTS.pathPasswordPolicy, 'get')
    return parsePasswordPolicy(this._dataMap(json))
  }

  /** Cambia la contraseña (revoca las demás sesiones). */
  async changePassword(params: {
    currentPassword?: string
    newPassword: string
  }): Promise<void> {
    await this._request(AUTH_CONSTANTS.pathChangePassword, 'post', {
      authenticated: true,
      sendReauthentication: true,
      body: {
        new_password: params.newPassword,
        ...(params.currentPassword !== undefined
          ? { current_password: params.currentPassword }
          : {}),
      },
    })
  }

  /** Inicia el cambio de email (envía los OTP según `secure_email_change`). */
  async changeEmail(params: {
    newEmail: string
    currentPassword?: string
  }): Promise<void> {
    await this._request(AUTH_CONSTANTS.pathChangeEmail, 'post', {
      authenticated: true,
      sendReauthentication: true,
      body: {
        new_email: params.newEmail,
        ...(params.currentPassword !== undefined
          ? { current_password: params.currentPassword }
          : {}),
      },
    })
  }

  /** Confirma el cambio de email con los OTP recibidos. */
  async changeEmailConfirm(params: {
    tokenOld?: string
    tokenNew: string
  }): Promise<void> {
    await this._request(AUTH_CONSTANTS.pathChangeEmailConfirm, 'post', {
      authenticated: true,
      body: {
        token_new: params.tokenNew,
        ...(params.tokenOld !== undefined ? { token_old: params.tokenOld } : {}),
      },
    })
  }

  // ─── Tokens de un solo uso ──────────────────────────────────────────────

  /** Verifica un magic link (login sin contraseña). */
  async verifyMagicLink(params: { token: string }): Promise<AuthResponse> {
    const json = await this._request(
      AUTH_CONSTANTS.pathMagicLinkVerify,
      'post',
      { body: { token: params.token } },
    )
    return this._applyAuthResponse(this._dataMap(json))
  }

  /** Confirma la recuperación de contraseña (fija la nueva clave + login). */
  async recoverPassword(params: {
    token: string
    password: string
  }): Promise<AuthResponse> {
    const json = await this._request(AUTH_CONSTANTS.pathRecoveryConfirm, 'post', {
      body: { token: params.token, password: params.password },
    })
    return this._applyAuthResponse(this._dataMap(json))
  }

  /** Acepta una invitación (fija la contraseña + verifica email + login). */
  async acceptInvitation(params: {
    token: string
    password: string
  }): Promise<AuthResponse> {
    const json = await this._request(
      AUTH_CONSTANTS.pathAcceptInvitation,
      'post',
      { body: { token: params.token, password: params.password } },
    )
    return this._applyAuthResponse(this._dataMap(json))
  }

  // ─── Reautenticación ────────────────────────────────────────────────────

  /** Envía un OTP de reautenticación al email del usuario. */
  async reauthenticate(): Promise<boolean> {
    const json = await this._request(AUTH_CONSTANTS.pathReauthenticate, 'post', {
      authenticated: true,
    })
    return this._dataMap(json)['sent'] === true
  }

  /**
   * Confirma el OTP de reautenticación. Almacena el token para enviarlo como
   * `X-Reauthentication-Token` en operaciones sensibles.
   */
  async reauthenticateVerify(params: { token: string }): Promise<void> {
    const json = await this._request(
      AUTH_CONSTANTS.pathReauthenticateVerify,
      'post',
      { authenticated: true, body: { token: params.token } },
    )
    if (this._dataMap(json)['verified'] === true) {
      this._reauthenticationToken = params.token
    }
  }

  // ─── Ciclo de vida ──────────────────────────────────────────────────────

  /** Arranca el auto-refresh (p. ej. al volver a primer plano). */
  startAutoRefresh(): void {
    if (!this._autoRefreshToken) return
    if (this._currentSession !== null) this._scheduleAutoRefresh()
  }

  /** Detiene el auto-refresh (p. ej. al pasar a segundo plano). */
  stopAutoRefresh(): void {
    if (this._autoRefreshTicker !== null) {
      clearTimeout(this._autoRefreshTicker)
      this._autoRefreshTicker = null
    }
  }

  /** Libera recursos (timers y listeners). */
  dispose(): void {
    this.stopAutoRefresh()
    this._listeners.clear()
  }

  /**
   * Suscribe un listener a los cambios de estado de autenticación.
   * Devuelve un objeto con `unsubscribe()`.
   *
   * Equivalente al stream `onAuthStateChange` del SDK Dart: si ya hubo un
   * evento, se repite inmediatamente al nuevo suscriptor (replay).
   */
  onAuthStateChange(
    listener: (event: AuthChangeEvent, session: Session | null) => void,
    onError?: (error: unknown) => void,
  ): AuthSubscription {
    const entry: AuthStateListener = { onEvent: listener, onError }
    this._listeners.add(entry)
    if (this._lastEvent !== null) {
      listener(this._lastEvent, this._currentSession)
    }
    return {
      unsubscribe: () => {
        this._listeners.delete(entry)
      },
    }
  }

  /**
   * Emite un error en el canal de estado (equivalente a `notifyError` del SDK
   * Dart, que empuja el error al stream `onAuthStateChange`).
   */
  notifyError(error: unknown): void {
    for (const entry of this._listeners) {
      entry.onError?.(error)
    }
  }

  // ─── Internals (usados por los sub-APIs) ────────────────────────────────

  /** @internal Envía un request a la API con los headers correctos. */
  async _request(
    path: string,
    method: RequestMethod,
    options: InternalRequestOptions = {},
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = { ...this._headers }
    const withCredentials = this._delivery === 'cookie'

    if (this._delivery === 'bearer') {
      // Siempre pedimos los tokens en el body (funciona en browser y Node).
      headers[AUTH_CONSTANTS.headerAuthDelivery] =
        AUTH_CONSTANTS.authDeliveryBearer
      if (options.authenticated) {
        const token = this.accessToken
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        if (options.sendReauthentication && this._reauthenticationToken) {
          headers[AUTH_CONSTANTS.headerReauthenticationToken] =
            this._reauthenticationToken
        }
      } else {
        headers[AUTH_CONSTANTS.headerOrganizationSlug] = this._organizationSlug
      }
    } else {
      // Modo cookies: la sesión viaja en cookies httpOnly.
      if (!options.authenticated) {
        headers[AUTH_CONSTANTS.headerOrganizationSlug] = this._organizationSlug
      }
    }

    const requestOptions: RequestOptions = {
      headers,
      body: options.body,
      query: options.query,
      withCredentials,
    }

    return this._fetch.request(`${this._baseUrl}${path}`, method, requestOptions)
  }

  /** @internal Extrae `data` del envelope. */
  _data(envelope: Record<string, unknown>): unknown {
    return envelope['data']
  }

  /** @internal Extrae `data` como objeto. */
  _dataMap(envelope: Record<string, unknown>): Record<string, unknown> {
    const data = envelope['data']
    return data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {}
  }

  /** @internal Aplica una respuesta de auth (guarda sesión y notifica). */
  async _applyAuthResponse(
    data: Record<string, unknown>,
  ): Promise<AuthResponse> {
    let response = parseAuthResponse(data)
    if (this._delivery === 'cookie' && response.session === null) {
      // En modo cookies la sesión vive en el servidor; marcamos estado local.
      response = { ...response, session: Session.cookieSession() }
    }
    if (response.session) {
      await this._saveSession(response.session, 'signedIn')
    }
    return response
  }

  /** @internal Guarda la sesión actual y notifica. */
  async _saveSession(
    session: Session,
    event: AuthChangeEvent,
  ): Promise<void> {
    this._sessionVersion++
    this._currentSession = session
    if (!session.isCookieSession) {
      await this._storage.setItem(this._storageKey, session.persistSessionString)
    } else {
      await this._storage.removeItem(this._storageKey)
    }
    if (this._autoRefreshToken && !session.isCookieSession) {
      this._scheduleAutoRefresh()
    }
    this._notifyAllSubscribers(event)
  }

  /** @internal Limpia la sesión actual y notifica. */
  async _removeSession(event: AuthChangeEvent): Promise<void> {
    this._sessionVersion++
    this._currentSession = null
    this._reauthenticationToken = null
    this.stopAutoRefresh()
    await this._storage.removeItem(this._storageKey)
    this._notifyAllSubscribers(event)
  }

  private _notifyAllSubscribers(event: AuthChangeEvent): void {
    this._lastEvent = event
    for (const entry of this._listeners) {
      entry.onEvent(event, this._currentSession)
    }
  }

  private _scheduleAutoRefresh(): void {
    if (!this._autoRefreshToken) return
    this.stopAutoRefresh()
    const session = this._currentSession
    if (session === null || session.isCookieSession) return
    const expiresAt = session.accessTokenExpiresAt
    if (!expiresAt) return
    const delay = expiresAt.getTime() - Date.now() - DEFAULT_EXPIRY_MARGIN_MS
    this._autoRefreshTicker = setTimeout(
      () => {
        void this._autoRefreshTick()
      },
      Math.max(delay, 0),
    )
  }

  private async _autoRefreshTick(): Promise<void> {
    const session = this._currentSession
    if (session === null) return
    try {
      await this._callRefreshToken(session.refreshToken)
    } catch {
      // El refresh ya manejó el error (signOut o reintentos agotados).
    }
  }

  private _callRefreshToken(
    refreshToken?: string | null,
  ): Promise<AuthResponse> {
    const token = refreshToken ?? this.refreshToken
    if (!token || token.length === 0) {
      return Promise.reject(new AsgateInvalidRefreshTokenException())
    }
    const pending = this._pendingRefreshes.get(token)
    if (pending) return pending

    const promise = this._doRefresh(token, 0).finally(() => {
      this._pendingRefreshes.delete(token)
    })
    this._pendingRefreshes.set(token, promise)
    return promise
  }

  private async _doRefresh(
    refreshToken: string,
    retryCount: number,
  ): Promise<AuthResponse> {
    const versionBefore = this._sessionVersion
    try {
      const json = await this._request(AUTH_CONSTANTS.pathRefresh, 'post', {
        body: { refresh_token: refreshToken },
      })
      const response = parseAuthResponse(this._dataMap(json))
      let session = response.session
      if (this._delivery === 'cookie' && session === null) {
        session = Session.cookieSession()
      }
      if (session === null) {
        throw new AsgateException('Refresh did not return a session')
      }
      // Descarta el resultado si la sesión cambió mientras tanto.
      if (this._sessionVersion !== versionBefore) {
        return { ...response, session }
      }
      await this._saveSession(session, 'tokenRefreshed')
      return { ...response, session }
    } catch (error) {
      if (error instanceof AsgateRetryableException) {
        if (retryCount >= AUTH_CONSTANTS.maxRetryCount) throw error
        const delay =
          AUTH_CONSTANTS.retryIntervalMs * Math.pow(2, retryCount)
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this._doRefresh(refreshToken, retryCount + 1)
      }
      if (error instanceof AsgateApiException) {
        if (error.isInvalidRefreshToken || error.isSessionExpired) {
          await this._removeSession('signedOut')
        }
      }
      throw error
    }
  }
}

/** Crea un cliente asgate (conveniencia). */
export function createClient(options: AsgateClientOptions): AsgateClient {
  return new AsgateClient(options)
}
