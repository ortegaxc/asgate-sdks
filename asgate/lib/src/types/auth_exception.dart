import 'error_code.dart';

/// Excepción base del SDK asgate.
class AsgateException implements Exception {
  const AsgateException(this.message);

  final String message;

  @override
  String toString() => 'AsgateException: $message';
}

/// Error devuelto por el servidor (envelope
/// `{status_code, error: {code, userMessage, details?}}`).
class AsgateApiException extends AsgateException {
  AsgateApiException({
    required this.statusCode,
    required this.code,
    required this.userMessage,
    this.details,
  }) : super('$code: $userMessage');

  final int statusCode;

  /// Código expuesto por la API (p. ej. `CLG001_INVALID_CREDENTIALS`).
  final String code;

  final String userMessage;

  /// Errores por campo (solo en validaciones `0900`).
  final List<ApiErrorDetail>? details;

  /// True si el código de error termina en [suffix] (p. ej.
  /// `ex.isErrorCode(ErrorCodes.invalidCredentials)`).
  bool isErrorCode(String suffix) => code.endsWith(suffix);

  @override
  String toString() => 'AsgateApiException($statusCode) $code: $userMessage';
}

/// Detalle de un error de validación de un campo.
class ApiErrorDetail {
  ApiErrorDetail({required this.field, required this.messages});

  final String field;
  final List<String> messages;

  factory ApiErrorDetail.fromJson(Map<String, dynamic> json) => ApiErrorDetail(
    field: json['field'] as String? ?? '',
    messages: (json['messages'] as List<dynamic>? ?? const [])
        .map((e) => e.toString())
        .toList(),
  );
}

/// Error retryable: red no alcanzada o respuesta 5xx del servidor.
class AsgateRetryableException extends AsgateException {
  AsgateRetryableException(super.message, {this.statusCode});

  final int? statusCode;

  @override
  String toString() =>
      'AsgateRetryableException'
      '${statusCode != null ? '($statusCode)' : ''}: $message';
}

/// No hay sesión activa.
class AsgateSessionMissingException extends AsgateException {
  const AsgateSessionMissingException() : super('No active session');
}

/// El refresh token es inválido o fue revocado.
class AsgateInvalidRefreshTokenException extends AsgateException {
  const AsgateInvalidRefreshTokenException()
    : super('Invalid or revoked refresh token');
}

/// Helper de conveniencia que comprueba los códigos de error frecuentes.
extension AsgateApiExceptionX on AsgateApiException {
  bool get isInvalidCredentials => isErrorCode(ErrorCodes.invalidCredentials);

  bool get isInvalidRefreshToken =>
      isErrorCode(ErrorCodes.invalidRefreshToken) ||
      isErrorCode(ErrorCodes.refreshTokenReused);

  bool get isSessionExpired => isErrorCode(ErrorCodes.sessionExpired);

  bool get isRateLimitExceeded => isErrorCode(ErrorCodes.rateLimitExceeded);

  bool get isReauthRequired => isErrorCode(ErrorCodes.reauthRequired);

  bool get isMfaEnrollmentRequired =>
      isErrorCode(ErrorCodes.mfaEnrollmentRequired);
}
