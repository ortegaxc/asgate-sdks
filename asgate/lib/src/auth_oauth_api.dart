part of 'asgate_client.dart';

/// Namespace OAuth/OIDC custom del cliente (`/api/v1/auth/oidc/*`).
class AsgateOAuthApi {
  AsgateOAuthApi(this._client);

  final AsgateClient _client;

  /// Inicia el login OIDC custom y devuelve la URL de autorización del IdP
  /// (el `state` viaja embebido). La app debe abrir esta URL en el navegador
  /// externo.
  Future<OidcStartResponse> getOidcSignInUrl() async {
    final json = await _client._request(
      AuthConstants.pathOidcStart,
      AsgateRequestMethod.get,
    );
    return OidcStartResponse.fromJson(_client._dataMap(json));
  }

  /// Completa el flujo OIDC a partir del deep link del callback
  /// (`?code=...&state=...`). Intercambia el code contra el backend y extrae
  /// los tokens del fragment de la `redirect_url` resultante.
  Future<AuthResponse> handleOidcCallback(Uri callbackUri) async {
    final query = callbackUri.queryParameters;
    final error = query['error'];
    if (error != null && error.isNotEmpty) {
      throw AsgateException('OAuth error: $error');
    }
    final code = query['code'];
    final state = query['state'];
    if (code == null || state == null || code.isEmpty || state.isEmpty) {
      throw const AsgateException('OIDC callback missing code or state');
    }

    final json = await _client._request(
      AuthConstants.pathOidcCallback,
      AsgateRequestMethod.get,
      query: {'code': code, 'state': state},
    );

    final redirectUrl = _client._dataMap(json)['redirect_url'] as String?;
    if (redirectUrl == null || redirectUrl.isEmpty) {
      throw const AsgateException(
        'OIDC callback did not return a redirect_url',
      );
    }

    final session = Session.fromOidcRedirectUrl(redirectUrl);
    if (session == null) {
      throw const AsgateException('OIDC redirect_url has no tokens');
    }

    await _client._saveSession(session, event: AuthChangeEvent.signedIn);
    return AuthResponse(session: session);
  }
}
