/**
 * Constantes internas del SDK (no forman parte de la API pública).
 */
export const AUTH_CONSTANTS = {
  /** Margen de seguridad antes de considerar expirado un access token (ms). */
  expiryMarginMs: 30_000,

  /** Máximo de reintentos de un refresh ante errores retryables. */
  maxRetryCount: 3,

  /** Intervalo base del backoff exponencial (ms). */
  retryIntervalMs: 500,

  /** Prefijo de la clave de almacenamiento de la sesión. */
  defaultStorageKeyPrefix: 'asgate.session',

  // ─── Headers ────────────────────────────────────────────────────────────

  headerOrganizationSlug: 'X-Organization-Slug',
  headerAuthDelivery: 'X-Auth-Delivery',
  headerReauthenticationToken: 'X-Reauthentication-Token',
  headerBusinessId: 'X-Business-Id',

  authDeliveryBearer: 'bearer',

  // ─── Rutas — Client Auth API (absolutas; sin global prefix) ────────────

  pathSignup: '/api/v1/auth/signup',
  pathLogin: '/api/v1/auth/login',
  pathRefresh: '/api/v1/auth/refresh',
  pathLogout: '/api/v1/auth/logout',
  pathMe: '/api/v1/auth/me',
  pathPasswordPolicy: '/api/v1/auth/password-policy',
  pathVerifyEmail: '/api/v1/auth/verify-email',
  pathVerifyPhone: '/api/v1/auth/verify-phone',
  pathResendVerification: '/api/v1/auth/resend-verification',
  pathChangePassword: '/api/v1/auth/change-password',
  pathChangeEmail: '/api/v1/auth/change-email',
  pathChangeEmailConfirm: '/api/v1/auth/change-email/confirm',
  pathAcceptInvitation: '/api/v1/auth/accept-invitation',
  pathMagicLinkVerify: '/api/v1/auth/magic-link/verify',
  pathRecoveryConfirm: '/api/v1/auth/recovery/confirm',
  pathReauthenticate: '/api/v1/auth/reauthenticate',
  pathReauthenticateVerify: '/api/v1/auth/reauthenticate/verify',
  pathFactors: '/api/v1/auth/factors',
  pathMfaVerify: '/api/v1/auth/mfa/verify',
  pathOidcStart: '/api/v1/auth/oidc/start',
  pathOidcCallback: '/api/v1/auth/oidc/callback',

  // ─── Rutas — Organization API (server-to-server, API key) ──────────────

  pathOrgMembers: '/api/v1/organizations/members',
  pathOrgRoles: '/api/v1/organizations/roles',
  pathOrgPermissions: '/api/v1/organizations/permissions',
} as const

export type AuthConstants = typeof AUTH_CONSTANTS
