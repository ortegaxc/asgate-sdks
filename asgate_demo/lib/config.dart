/// Configuración de la app demo (edítala según tu entorno).
class AppConfig {
  AppConfig._();

  /// Base del servidor de auth (ms-auth dev).
  static const String baseUrl = 'http://10.0.2.2:4440';

  /// Slug de la organización (tenant).
  static const String organizationSlug = 'asnexus';

  /// Esquema del deep link de OIDC (debe coincidir con el `redirect_uri`
  /// configurado en el provider `oidc_custom` de la org y con el
  /// Info.plist / AndroidManifest de la app).
  static const String deepLinkScheme = 'asgatedemo';
  static const String oidcCallbackPath = 'auth/callback';
}
