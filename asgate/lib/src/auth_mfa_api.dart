part of 'asgate_client.dart';

/// Namespace MFA del cliente asgate (`/api/v1/auth/factors*` y
/// `/api/v1/auth/mfa/verify`).
class AsgateMFAApi {
  AsgateMFAApi(this._client);

  final AsgateClient _client;

  /// Lista los factores MFA del usuario.
  Future<List<MfaFactor>> listFactors() async {
    final json = await _client._request(
      AuthConstants.pathFactors,
      AsgateRequestMethod.get,
      authenticated: true,
    );
    final data = _client._data(json);
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(MfaFactor.fromJson)
        .toList();
  }

  /// Enrola un factor MFA. TOTP devuelve `otpUri` (QR); sms/email envían un código.
  Future<MfaEnrollResult> enrollFactor({
    required MfaFactorType factorType,
    String? friendlyName,
    String? phone,
  }) async {
    final json = await _client._request(
      AuthConstants.pathFactors,
      AsgateRequestMethod.post,
      authenticated: true,
      body: {
        'factor_type': factorType.value,
        if (friendlyName != null) 'friendly_name': friendlyName,
        if (phone != null) 'phone': phone,
      },
    );
    return MfaEnrollResult.fromJson(_client._dataMap(json));
  }

  /// Confirma el enrolamiento de un factor con el código de 6 dígitos.
  Future<MfaFactor> verifyFactor({
    required String factorId,
    required String code,
  }) async {
    final json = await _client._request(
      '${AuthConstants.pathFactors}/$factorId/verify',
      AsgateRequestMethod.post,
      authenticated: true,
      body: {'code': code},
    );
    final data = _client._dataMap(json);
    final factor = data['factor'];
    return MfaFactor.fromJson(
      factor is Map<String, dynamic> ? factor : const {},
    );
  }

  /// Solicita un código de login para un factor `verified`.
  Future<MfaChallengeResult> challengeFactor({required String factorId}) async {
    final json = await _client._request(
      '${AuthConstants.pathFactors}/$factorId/challenge',
      AsgateRequestMethod.post,
      authenticated: true,
    );
    return MfaChallengeResult.fromJson(_client._dataMap(json));
  }

  /// Desenrola un factor MFA (requiere reautenticación si la sesión es vieja).
  Future<void> unenrollFactor({required String factorId}) async {
    await _client._request(
      '${AuthConstants.pathFactors}/$factorId',
      AsgateRequestMethod.delete,
      authenticated: true,
      sendReauthentication: true,
    );
  }

  /// Completa el segundo factor: sube la sesión de aal1 a aal2 y devuelve la
  /// nueva sesión (emite `mfaChallengeVerified`).
  Future<AuthResponse> verifyMfa({
    required String factorId,
    required String code,
  }) async {
    final session = _client._currentSession;
    final json = await _client._request(
      AuthConstants.pathMfaVerify,
      AsgateRequestMethod.post,
      body: {
        'factor_id': factorId,
        'code': code,
        if (session?.refreshToken != null)
          'refresh_token': session!.refreshToken,
      },
    );
    final response = AuthResponse.fromJson(_client._dataMap(json));
    final newSession = response.session;
    if (newSession != null) {
      await _client._saveSession(
        newSession,
        event: AuthChangeEvent.mfaChallengeVerified,
      );
    }
    return response;
  }
}
