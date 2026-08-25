/**
 * asgate-js — SDK de TypeScript/JavaScript para la Client API de asgate (ms-auth).
 *
 * Alcance idéntico al SDK Dart/Flutter (`asgate` / `asgate_flutter`):
 * autenticación de usuarios finales (`/api/v1/auth/*`).
 */
export { AsgateClient, createClient } from './asgate-client'
export { AsgateMFAApi } from './auth/mfa-api'
export { AsgateOAuthApi } from './auth/oauth-api'

// ─── Errores ──────────────────────────────────────────────────────────────
export {
  AsgateException,
  AsgateError,
  AsgateApiException,
  AsgateApiError,
  AsgateRetryableException,
  AsgateRetryableError,
  AsgateSessionMissingException,
  AsgateInvalidRefreshTokenException,
  ErrorCodes,
  isAsgateException,
  isAsgateError,
  isAsgateApiException,
  isAsgateApiError,
  isAsgateRetryableException,
  isAsgateRetryableError,
} from './lib/errors'
export type { ApiErrorDetail, ErrorCodeSuffix } from './lib/errors'

// ─── Sesión ───────────────────────────────────────────────────────────────
export { Session } from './lib/session'

// ─── Storage ──────────────────────────────────────────────────────────────
export {
  memoryLocalStorageAdapter,
  InMemoryStorage,
  SessionMemoryStorage,
} from './lib/storage'
export type { SupportedStorage } from './lib/storage'

// ─── Helpers ──────────────────────────────────────────────────────────────
export { decodeJwtPayload, normalizeUrl, parseDate } from './lib/helpers'

// ─── Tipos públicos (Client Auth) ─────────────────────────────────────────
export type {
  AuthChangeEvent,
  AuthState,
  AuthResponse,
  AuthSubscription,
  SignOutScope,
  MfaFactorType,
  MfaFactorStatus,
  VerificationType,
  PasswordComplexity,
  PasswordPolicy,
  AsgateUser,
  Me,
  Organization,
  MfaFactor,
  MfaEnrollResult,
  MfaChallengeResult,
  MfaRequiredResult,
  OidcStartResponse,
  SignupResponse,
  TokenDelivery,
  AsgateClientOptions,
  AuthChangeListener,
} from './lib/types'

export { version } from './lib/version'
