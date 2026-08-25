/**
 * Taxonomía de errores del SDK asgate.
 *
 * El servidor responde el envelope de error
 * `{status_code, error: {code, userMessage, description?, details?}}`.
 * El campo `code` viene con prefijo de feature (p. ej. `CLG001_INVALID_CREDENTIALS`);
 * los sufijos se comparan con `isErrorCode(...)` / los flags de conveniencia.
 */

/** Detalle de un error de validación de un campo (código `0900`). */
export interface ApiErrorDetail {
  field: string
  messages: string[]
}

/** Excepción base del SDK asgate. */
export class AsgateException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AsgateException'
  }
}

/** Alias de compatibilidad del nombre de la excepción base. */
export { AsgateException as AsgateError }

/** Error devuelto por el servidor (envelope de error estándar). */
export class AsgateApiException extends AsgateException {
  readonly statusCode: number
  readonly code: string
  readonly userMessage: string
  readonly details?: ApiErrorDetail[]

  constructor(opts: {
    statusCode: number
    code: string
    userMessage: string
    details?: ApiErrorDetail[]
  }) {
    super(`${opts.code}: ${opts.userMessage}`)
    this.name = 'AsgateApiException'
    this.statusCode = opts.statusCode
    this.code = opts.code
    this.userMessage = opts.userMessage
    this.details = opts.details
  }

  /** True si el código de error termina en `suffix` (p. ej. `INVALID_CREDENTIALS`). */
  isErrorCode(suffix: string): boolean {
    return this.code.endsWith(suffix)
  }

  // ─── Flags de conveniencia ──────────────────────────────────────────────

  get isInvalidCredentials(): boolean {
    return this.isErrorCode(ErrorCodes.invalidCredentials)
  }

  get isInvalidRefreshToken(): boolean {
    return (
      this.isErrorCode(ErrorCodes.invalidRefreshToken) ||
      this.isErrorCode(ErrorCodes.refreshTokenReused)
    )
  }

  get isSessionExpired(): boolean {
    return this.isErrorCode(ErrorCodes.sessionExpired)
  }

  get isRateLimitExceeded(): boolean {
    return this.isErrorCode(ErrorCodes.rateLimitExceeded)
  }

  get isReauthRequired(): boolean {
    return this.isErrorCode(ErrorCodes.reauthRequired)
  }

  get isMfaEnrollmentRequired(): boolean {
    return this.isErrorCode(ErrorCodes.mfaEnrollmentRequired)
  }

  get isEmailNotConfirmed(): boolean {
    return this.isErrorCode(ErrorCodes.emailNotConfirmed)
  }
}

/** Alias de compatibilidad del nombre del error de API. */
export { AsgateApiException as AsgateApiError }

/** Error retryable: red no alcanzada o respuesta 5xx del servidor. */
export class AsgateRetryableException extends AsgateException {
  readonly statusCode?: number

  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'AsgateRetryableException'
    this.statusCode = statusCode
  }
}

/** Alias de compatibilidad del nombre del error retryable. */
export { AsgateRetryableException as AsgateRetryableError }

/** No hay sesión activa. */
export class AsgateSessionMissingException extends AsgateException {
  constructor() {
    super('No active session')
    this.name = 'AsgateSessionMissingException'
  }
}

/** El refresh token es inválido o fue revocado. */
export class AsgateInvalidRefreshTokenException extends AsgateException {
  constructor() {
    super('Invalid or revoked refresh token')
    this.name = 'AsgateInvalidRefreshTokenException'
  }
}

/**
 * Códigos de error frecuentes de la Client API.
 * El campo `AsgateApiError.code` viene con prefijo de feature; estos sufijos se
 * comparan con `AsgateApiError.isErrorCode(...)`.
 */
export const ErrorCodes = {
  invalidCredentials: 'INVALID_CREDENTIALS',
  invalidRefreshToken: 'INVALID_REFRESH_TOKEN',
  refreshTokenReused: 'REFRESH_TOKEN_REUSED',
  sessionExpired: 'SESSION_EXPIRED',
  rateLimitExceeded: 'RATE_LIMIT_EXCEEDED',
  emailNotConfirmed: 'EMAIL_NOT_CONFIRMED',
  passwordNotSet: 'PASSWORD_NOT_SET',
  reauthRequired: 'REAUTH_REQUIRED',
  mfaEnrollmentRequired: 'MFA_ENROLLMENT_REQUIRED',
  tokenExpired: 'TOKEN_EXPIRED',
  tokenUsed: 'TOKEN_USED',
  invalidToken: 'INVALID_TOKEN',
} as const

export type ErrorCodeSuffix = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// ─── Type guards ──────────────────────────────────────────────────────────

export function isAsgateException(error: unknown): error is AsgateException {
  return error instanceof AsgateException
}

export function isAsgateApiException(
  error: unknown,
): error is AsgateApiException {
  return error instanceof AsgateApiException
}

export function isAsgateRetryableException(
  error: unknown,
): error is AsgateRetryableException {
  return error instanceof AsgateRetryableException
}

// Alias de los guards con el nombre `AsgateError` (compatibilidad).
export const isAsgateError = isAsgateException
export const isAsgateApiError = isAsgateApiException
export const isAsgateRetryableError = isAsgateRetryableException
