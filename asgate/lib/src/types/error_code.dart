/// Códigos de error frecuentes de la Client API.
///
/// El campo `AsgateApiException.code` viene con prefijo de feature
/// (p. ej. `CLG001_INVALID_CREDENTIALS`); estos sufijos se comparan con
/// `AsgateApiException.isErrorCode(...)`.
class ErrorCodes {
  ErrorCodes._();

  static const String invalidCredentials = 'INVALID_CREDENTIALS';
  static const String invalidRefreshToken = 'INVALID_REFRESH_TOKEN';
  static const String refreshTokenReused = 'REFRESH_TOKEN_REUSED';
  static const String sessionExpired = 'SESSION_EXPIRED';
  static const String rateLimitExceeded = 'RATE_LIMIT_EXCEEDED';
  static const String emailNotConfirmed = 'EMAIL_NOT_CONFIRMED';
  static const String passwordNotSet = 'PASSWORD_NOT_SET';
  static const String reauthRequired = 'REAUTH_REQUIRED';
  static const String mfaEnrollmentRequired = 'MFA_ENROLLMENT_REQUIRED';
  static const String tokenExpired = 'TOKEN_EXPIRED';
  static const String tokenUsed = 'TOKEN_USED';
  static const String invalidToken = 'INVALID_TOKEN';
}
