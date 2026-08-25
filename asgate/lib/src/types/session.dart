import 'dart:convert';

import '../auth_constants.dart';
import '../helper.dart';
import 'user.dart';

/// Sesión de la Client API (`ClientAuthViewModel`).
///
/// El access token es un JWT de vida corta; `refresh_token` es opaco y rota
/// en cada refresh. `sessionExpiresAt` es el vencimiento duro de la sesión
/// (`not_after` del campo `expires_at`).
class Session {
  Session({
    required this.accessToken,
    this.refreshToken,
    this.tokenType = 'bearer',
    this.expiresIn,
    this.accessTokenExpiresAt,
    this.sessionExpiresAt,
    this.user,
    this.mustChangePassword,
  });

  final String accessToken;
  final String? refreshToken;
  final String tokenType;

  /// Vida del access token en segundos (tal como la devuelve la API).
  final int? expiresIn;

  /// Momento en que expira el access token (derivado de `expires_in` o JWT `exp`).
  final DateTime? accessTokenExpiresAt;

  /// Vencimiento duro de la sesión (`expires_at` / `not_after`).
  final DateTime? sessionExpiresAt;

  /// Usuario asociado. Null durante una sesión aal1 pendiente de MFA.
  final AsgateUser? user;

  final bool? mustChangePassword;

  /// True si el access token está vencido o a punto de vencer (margen 30s).
  bool get isExpired {
    final at = accessTokenExpiresAt;
    if (at == null) return false;
    return at.difference(DateTime.now()) <= AuthConstants.expiryMargin;
  }

  /// True si la sesión pasó su vencimiento duro (`not_after`).
  bool get isSessionExpired {
    final at = sessionExpiresAt;
    if (at == null) return false;
    return !at.isAfter(DateTime.now());
  }

  static DateTime? _parseDate(dynamic value) => parseDateTime(value);

  static DateTime? _accessTokenExpiry(
    Map<String, dynamic> json, {
    DateTime? now,
  }) {
    final nowAt = now ?? DateTime.now();
    final expiresIn = (json['expires_in'] as num?)?.toInt();
    if (expiresIn != null) {
      return nowAt.add(Duration(seconds: expiresIn));
    }
    final accessToken = json['access_token'] as String?;
    if (accessToken != null) {
      final exp = decodeJwtPayload(accessToken)['exp'];
      if (exp is int) {
        return DateTime.fromMillisecondsSinceEpoch(exp * 1000);
      }
    }
    return null;
  }

  /// Parsea una respuesta de la API. Devuelve null si no trae `access_token`.
  static Session? fromJson(Map<String, dynamic> json, {DateTime? now}) {
    final accessToken = json['access_token'];
    if (accessToken is! String || accessToken.isEmpty) return null;
    return Session(
      accessToken: accessToken,
      refreshToken: json['refresh_token'] as String?,
      tokenType: json['token_type'] as String? ?? 'bearer',
      expiresIn: (json['expires_in'] as num?)?.toInt(),
      accessTokenExpiresAt: _accessTokenExpiry(json, now: now),
      sessionExpiresAt: _parseDate(json['expires_at']),
      user: json['user'] is Map<String, dynamic>
          ? AsgateUser.fromJson(json['user'] as Map<String, dynamic>)
          : null,
      mustChangePassword: json['must_change_password'] as bool?,
    );
  }

  Map<String, dynamic> toJson() => {
    'access_token': accessToken,
    'refresh_token': refreshToken,
    'token_type': tokenType,
    'expires_in': expiresIn,
    'access_token_expires_at': accessTokenExpiresAt?.toIso8601String(),
    'expires_at': sessionExpiresAt?.toIso8601String(),
    'user': user?.toJson(),
    'must_change_password': mustChangePassword,
  };

  /// JSON persistible de la sesión.
  String get persistSessionString => json.encode(toJson());

  /// Extrae una sesión de una `redirect_url` OIDC
  /// (`.../auth/callback#access_token=...&refresh_token=...`).
  static Session? fromOidcRedirectUrl(String redirectUrl) {
    final uri = Uri.tryParse(redirectUrl);
    if (uri == null) return null;
    final params = Uri.splitQueryString(uri.fragment);
    final accessToken = params['access_token'];
    final refreshToken = params['refresh_token'];
    if (accessToken == null || accessToken.isEmpty) return null;

    final claims = decodeJwtPayload(accessToken);
    DateTime? accessTokenExpiresAt;
    final exp = claims['exp'];
    if (exp is int) {
      accessTokenExpiresAt = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
    }

    AsgateUser? user;
    final sub = claims['sub'];
    if (sub is String) {
      final email = claims['email'];
      user = AsgateUser(
        id: sub,
        email: email is String ? email : '',
        fullName: '',
      );
    }

    return Session(
      accessToken: accessToken,
      refreshToken: refreshToken,
      tokenType: 'bearer',
      accessTokenExpiresAt: accessTokenExpiresAt,
      user: user,
    );
  }

  /// Restaura una sesión persistida. Devuelve null si el JSON es inválido.
  static Session? fromPersisted(String jsonString) {
    try {
      final map = json.decode(jsonString);
      if (map is! Map<String, dynamic>) return null;
      final accessToken = map['access_token'];
      if (accessToken is! String || accessToken.isEmpty) return null;
      final persistedExpiry = map['access_token_expires_at'];
      return Session(
        accessToken: accessToken,
        refreshToken: map['refresh_token'] as String?,
        tokenType: map['token_type'] as String? ?? 'bearer',
        expiresIn: (map['expires_in'] as num?)?.toInt(),
        accessTokenExpiresAt: persistedExpiry is String
            ? DateTime.tryParse(persistedExpiry)
            : _accessTokenExpiry(map),
        sessionExpiresAt: _parseDate(map['expires_at']),
        user: map['user'] is Map<String, dynamic>
            ? AsgateUser.fromJson(map['user'] as Map<String, dynamic>)
            : null,
        mustChangePassword: map['must_change_password'] as bool?,
      );
    } catch (_) {
      return null;
    }
  }

  Session copyWith({
    String? accessToken,
    String? refreshToken,
    String? tokenType,
    int? expiresIn,
    DateTime? accessTokenExpiresAt,
    DateTime? sessionExpiresAt,
    AsgateUser? user,
    bool? mustChangePassword,
  }) => Session(
    accessToken: accessToken ?? this.accessToken,
    refreshToken: refreshToken ?? this.refreshToken,
    tokenType: tokenType ?? this.tokenType,
    expiresIn: expiresIn ?? this.expiresIn,
    accessTokenExpiresAt: accessTokenExpiresAt ?? this.accessTokenExpiresAt,
    sessionExpiresAt: sessionExpiresAt ?? this.sessionExpiresAt,
    user: user ?? this.user,
    mustChangePassword: mustChangePassword ?? this.mustChangePassword,
  );
  @override
  String toString() =>
      'Session(accessToken: ${accessToken.substring(0, accessToken.length < 8 ? accessToken.length : 8)}..., '
      'expiresIn: $expiresIn, user: ${user?.email ?? 'null'})';
}
