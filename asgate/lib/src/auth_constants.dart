import 'package:meta/meta.dart';

/// Constantes internas del SDK (no públicas).
@internal
class AuthConstants {
  AuthConstants._();

  /// Margen de seguridad antes de considerar expirado un access token.
  static const Duration expiryMargin = Duration(seconds: 30);

  /// Máximo de reintentos de un refresh ante errores retryables.
  static const int maxRetryCount = 3;

  /// Intervalo base del backoff exponencial.
  static const Duration retryInterval = Duration(milliseconds: 500);

  /// Prefijo de la clave de almacenamiento de la sesión.
  static const String defaultStorageKeyPrefix = 'asgate.session';

  // ─── Headers ────────────────────────────────────────────────────────────

  static const String headerOrganizationSlug = 'X-Organization-Slug';
  static const String headerAuthDelivery = 'X-Auth-Delivery';
  static const String headerReauthenticationToken = 'X-Reauthentication-Token';

  static const String authDeliveryBearer = 'bearer';

  // ─── Rutas (absolutas; sin global prefix) ───────────────────────────────

  static const String pathSignup = '/api/v1/auth/signup';
  static const String pathLogin = '/api/v1/auth/login';
  static const String pathRefresh = '/api/v1/auth/refresh';
  static const String pathLogout = '/api/v1/auth/logout';
  static const String pathMe = '/api/v1/auth/me';
  static const String pathPasswordPolicy = '/api/v1/auth/password-policy';
  static const String pathVerifyEmail = '/api/v1/auth/verify-email';
  static const String pathVerifyPhone = '/api/v1/auth/verify-phone';
  static const String pathResendVerification =
      '/api/v1/auth/resend-verification';
  static const String pathChangePassword = '/api/v1/auth/change-password';
  static const String pathChangeEmail = '/api/v1/auth/change-email';
  static const String pathChangeEmailConfirm =
      '/api/v1/auth/change-email/confirm';
  static const String pathAcceptInvitation = '/api/v1/auth/accept-invitation';
  static const String pathMagicLinkVerify = '/api/v1/auth/magic-link/verify';
  static const String pathRecoveryConfirm = '/api/v1/auth/recovery/confirm';
  static const String pathReauthenticate = '/api/v1/auth/reauthenticate';
  static const String pathReauthenticateVerify =
      '/api/v1/auth/reauthenticate/verify';
  static const String pathFactors = '/api/v1/auth/factors';
  static const String pathMfaVerify = '/api/v1/auth/mfa/verify';
  static const String pathOidcStart = '/api/v1/auth/oidc/start';
  static const String pathOidcCallback = '/api/v1/auth/oidc/callback';
}
