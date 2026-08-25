/**
 * Tipos públicos del SDK asgate.
 *
 * Espejo de los modelos del SDK Dart (`asgate/lib/src/types/*`).
 */
import type { Session } from './session'

// ─── Enums (valores wire) ────────────────────────────────────────────────

/** Eventos del flujo de autenticación emitidos por `onAuthStateChange`. */
export type AuthChangeEvent =
  | 'initialSession'
  | 'signedIn'
  | 'signedOut'
  | 'tokenRefreshed'
  | 'userUpdated'
  | 'mfaChallengeVerified'

/** Alcance de cierre de sesión (`POST /api/v1/auth/logout?scope=...`). */
export type SignOutScope = 'local' | 'others' | 'global'

/** Tipo de factor MFA. */
export type MfaFactorType = 'totp' | 'sms' | 'email_otp'

/** Estado de un factor MFA. */
export type MfaFactorStatus = 'unverified' | 'verified'

/** Canal de verificación para reenviar códigos (`resend-verification`). */
export type VerificationType = 'email' | 'phone'

/** Nivel de complejidad de la política de contraseñas. */
export type PasswordComplexity =
  | 'NONE'
  | 'LETTERS_AND_DIGITS'
  | 'LOWER_UPPER_DIGITS'
  | 'FULL_COMPLEXITY'

// ─── Modelos básicos ─────────────────────────────────────────────────────

/** Perfil mínimo del usuario final en respuestas de auth (`ClientAuthUser`). */
export interface AsgateUser {
  id: string
  email: string
  fullName: string
}

/** Organización del token (`aud`) en `/me`. */
export interface Organization {
  id: string
  name: string
  slug: string
}

/** Perfil completo del usuario final (`GET /api/v1/auth/me`). */
export interface Me {
  id: string
  email?: string | null
  fullName: string
  emailVerified?: boolean | null
  phone?: string | null
  phoneVerified?: boolean | null
  isActive?: boolean | null
  displayName?: string | null
  avatarUrl?: string | null
  isBanned?: boolean | null
  roles: string[]
  organization: Organization
}

/** Factor MFA del usuario (nunca incluye el secret). */
export interface MfaFactor {
  id: string
  factorType: MfaFactorType
  status: MfaFactorStatus
  friendlyName?: string | null
  phone?: string | null
  lastChallengedAt?: Date | null
  createdAt?: Date | null
  isVerified: boolean
}

/** Resultado de enrolar un factor (`POST /api/v1/auth/factors`). */
export interface MfaEnrollResult {
  id: string
  factorType: MfaFactorType
  status: MfaFactorStatus
  /** `otpauth://` URI para TOTP (escanear con la app autenticadora). */
  otpUri?: string | null
  /** Destino del código de confirmación (sms/email). */
  sentTo?: string | null
}

/** Resultado de crear un challenge de login (`POST /api/v1/auth/factors/:id/challenge`). */
export interface MfaChallengeResult {
  /** `totp` (usa tu app) o `otp` (código enviado). */
  type: 'totp' | 'otp' | (string & {})
  sentTo?: string | null
  isTotp: boolean
}

/** Respuesta de login cuando se requiere el segundo factor (`mfa_required`). */
export interface MfaRequiredResult {
  /** Factores MFA del usuario (solo los `verified` son usables). */
  factors: MfaFactor[]
}

/** Respuesta de un flujo que emite sesión (login, refresh, verify, MFA, etc.). */
export interface AuthResponse {
  session: Session | null
  user: AsgateUser | null
  /** Presente cuando el login devuelve `mfa_required` (sesión aal1 pendiente). */
  mfaRequired: MfaRequiredResult | null
  readonly isMfaRequired: boolean
}

/** Respuesta de `POST /api/v1/auth/signup`. */
export interface SignupResponse {
  emailConfirmationRequired: boolean
  phoneConfirmationRequired: boolean
  user: AsgateUser
  session: Session | null
  readonly requiresConfirmation: boolean
}

/** Estado de autenticación emitido por `onAuthStateChange`. */
export interface AuthState {
  event: AuthChangeEvent
  session: Session | null
}

/** Política de contraseñas de la organización (`GET /api/v1/auth/password-policy`). */
export interface PasswordPolicy {
  minLength: number
  complexity: PasswordComplexity
  rules: string[]
}

/** Respuesta de `GET /api/v1/auth/oidc/start`. */
export interface OidcStartResponse {
  /** Nombre del provider (siempre `oidc_custom` en la Client API). */
  provider: string
  /** URL de autorización del IdP (contiene el `state` anti-CSRF embebido). */
  authorizeUrl: string
}

// ─── Callbacks / suscripciones ───────────────────────────────────────────

export type AuthChangeListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void

export interface AuthSubscription {
  unsubscribe: () => void
}

// ─── Opciones del cliente ─────────────────────────────────────────────────

/** Modo de entrega de los tokens de sesión. */
export type TokenDelivery = 'bearer' | 'cookie'

export interface AsgateClientOptions {
  /** URL base del servidor asgate (p. ej. `https://auth.example.com`). */
  url: string

  /** Slug de la organización/tenant (se envía como `X-Organization-Slug`). */
  organizationSlug: string

  /** Headers extra fusionados en cada request. */
  headers?: Record<string, string>

  /** Si `true`, renueva el access token proactivamente antes de que expire. */
  autoRefreshToken?: boolean

  /** Adapter de persistencia de la sesión (por defecto: en memoria). */
  storage?: SupportedStorage

  /** Clave de storage para la sesión (por defecto derivada de url + slug). */
  storageKey?: string

  /** Implementación de `fetch` personalizada. */
  fetch?: typeof fetch

  /**
   * Modo de entrega de tokens:
   * - `bearer` (default): tokens en el body con `X-Auth-Delivery: bearer`.
   * - `cookie`: cookies httpOnly (`cta_access`/`cta_refresh`) con
   *   `credentials: 'include'` (solo navegador).
   */
  delivery?: TokenDelivery
}

import type { SupportedStorage } from './storage'
