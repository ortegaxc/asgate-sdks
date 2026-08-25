/// Respuesta de `GET /api/v1/auth/oidc/start`.
class OidcStartResponse {
  OidcStartResponse({required this.provider, required this.authorizeUrl});

  /// Nombre del provider (siempre `oidc_custom` en la Client API).
  final String provider;

  /// URL de autorización del IdP (contiene el `state` anti-CSRF embebido).
  final String authorizeUrl;

  factory OidcStartResponse.fromJson(Map<String, dynamic> json) =>
      OidcStartResponse(
        provider: json['provider'] as String? ?? 'oidc_custom',
        authorizeUrl: json['authorize_url'] as String? ?? '',
      );
}
