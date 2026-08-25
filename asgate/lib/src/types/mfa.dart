import '../constants.dart';
import '../helper.dart';

/// Factor MFA del usuario (nunca incluye el secret).
class MfaFactor {
  MfaFactor({
    required this.id,
    required this.factorType,
    required this.status,
    this.friendlyName,
    this.phone,
    this.lastChallengedAt,
    this.createdAt,
  });

  final String id;
  final MfaFactorType factorType;
  final MfaFactorStatus status;
  final String? friendlyName;
  final String? phone;
  final DateTime? lastChallengedAt;
  final DateTime? createdAt;

  bool get isVerified => status == MfaFactorStatus.verified;

  factory MfaFactor.fromJson(Map<String, dynamic> json) => MfaFactor(
    id: json['id'] as String? ?? '',
    factorType: MfaFactorType.fromValue(json['factor_type'] as String?),
    status: MfaFactorStatus.fromValue(json['status'] as String?),
    friendlyName: json['friendly_name'] as String?,
    phone: json['phone'] as String?,
    lastChallengedAt: parseDateTime(json['last_challenged_at']),
    createdAt: parseDateTime(json['created_at']),
  );
}

/// Resultado de enrolar un factor (`POST /api/v1/auth/factors`).
class MfaEnrollResult {
  MfaEnrollResult({
    required this.id,
    required this.factorType,
    required this.status,
    this.otpUri,
    this.sentTo,
  });

  final String id;
  final MfaFactorType factorType;
  final MfaFactorStatus status;

  /// `otpauth://` URI para TOTP (escanear con la app autenticadora).
  final String? otpUri;

  /// Destino del código de confirmación (sms/email).
  final String? sentTo;

  factory MfaEnrollResult.fromJson(Map<String, dynamic> json) =>
      MfaEnrollResult(
        id: json['id'] as String? ?? '',
        factorType: MfaFactorType.fromValue(json['factor_type'] as String?),
        status: MfaFactorStatus.fromValue(json['status'] as String?),
        otpUri: json['otp_uri'] as String?,
        sentTo: json['sent_to'] as String?,
      );
}

/// Resultado de crear un challenge de login (`POST /api/v1/auth/factors/:id/challenge`).
class MfaChallengeResult {
  MfaChallengeResult({required this.type, this.sentTo});

  /// `totp` (usa tu app) o `otp` (código enviado).
  final String type;

  final String? sentTo;

  bool get isTotp => type == 'totp';

  factory MfaChallengeResult.fromJson(Map<String, dynamic> json) =>
      MfaChallengeResult(
        type: json['type'] as String? ?? 'totp',
        sentTo: json['sent_to'] as String?,
      );
}

/// Respuesta de login cuando se requiere el segundo factor (`mfa_required`).
///
/// Los tokens de la sesión aal1 viajan en `AuthResponse.session`.
class MfaRequiredResult {
  MfaRequiredResult({required this.factors});

  /// Factores MFA del usuario (solo los `verified` son usables).
  final List<MfaFactor> factors;

  factory MfaRequiredResult.fromJson(Map<String, dynamic> json) =>
      MfaRequiredResult(
        factors: (json['factors'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(MfaFactor.fromJson)
            .toList(),
      );
}
