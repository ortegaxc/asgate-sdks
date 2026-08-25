/// Eventos del flujo de autenticación, emitidos por
/// `AsgateClient.onAuthStateChange`.
enum AuthChangeEvent {
  /// Se restauró una sesión persistida al inicializar.
  initialSession,

  /// El usuario inició sesión (o se creó la sesión tras verificar un token).
  signedIn,

  /// El usuario cerró sesión (o la sesión se invalidó).
  signedOut,

  /// El access token se renovó automáticamente o a pedido.
  tokenRefreshed,

  /// Se actualizó la información del usuario (p. ej. tras `getMe`).
  userUpdated,

  /// Se completó el segundo factor (MFA) y la sesión subió a aal2.
  mfaChallengeVerified,
}

/// Alcance de cierre de sesión (`POST /api/v1/auth/logout?scope=...`).
enum SignOutScope {
  /// Revoca la sesión actual.
  local('local'),

  /// Revoca todas las sesiones del usuario en esta organización menos la actual.
  others('others'),

  /// Revoca todas las sesiones del usuario en todas las organizaciones.
  global('global');

  const SignOutScope(this.value);

  /// Valor enviado al backend.
  final String value;
}

/// Tipo de factor MFA.
enum MfaFactorType {
  totp('totp'),
  sms('sms'),
  emailOtp('email_otp');

  const MfaFactorType(this.value);

  final String value;

  static MfaFactorType fromValue(String? value) => MfaFactorType.values
      .firstWhere((e) => e.value == value, orElse: () => MfaFactorType.totp);
}

/// Estado de un factor MFA.
enum MfaFactorStatus {
  unverified('unverified'),
  verified('verified');

  const MfaFactorStatus(this.value);

  final String value;

  static MfaFactorStatus fromValue(String? value) =>
      MfaFactorStatus.values.firstWhere(
        (e) => e.value == value,
        orElse: () => MfaFactorStatus.unverified,
      );
}

/// Canal de verificación para reenviar códigos (`resend-verification`).
enum VerificationType {
  email('email'),
  phone('phone');

  const VerificationType(this.value);

  final String value;
}
