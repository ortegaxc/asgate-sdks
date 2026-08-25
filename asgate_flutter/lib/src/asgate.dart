import 'package:asgate/asgate.dart';

import 'asgate_auth.dart';
import 'flutter_client_options.dart';
import 'local_storage.dart';

/// Fachada singleton del SDK asgate para Flutter.
///
/// ```dart
/// await Asgate.initialize(
///   url: 'https://auth.example.com',
///   organizationSlug: 'my-org',
/// );
/// final client = Asgate.instance.client;
/// ```
class Asgate {
  Asgate._();

  static final Asgate _instance = Asgate._();

  static Asgate get instance {
    assert(
      _instance._isInitialized,
      'Asgate.initialize() must be called before accessing Asgate.instance',
    );
    return _instance;
  }

  AsgateClient? _client;
  AsgateAuth? _asgateAuth;
  bool _isInitialized = false;

  /// Inicializa el SDK (idempotente). Persiste la sesión en el almacenamiento
  /// seguro del dispositivo y conecta el ciclo de vida de la app.
  static Future<Asgate> initialize({
    required String url,
    required String organizationSlug,
    Map<String, String>? headers,
    bool autoRefreshToken = true,
    FlutterAsgateClientOptions options = const FlutterAsgateClientOptions(),
  }) async {
    if (_instance._isInitialized) return _instance;
    _instance._isInitialized = true;

    final storage = SecureAuthStorage(
      storageKey: defaultPersistSessionKey(url, organizationSlug),
    );

    final client = AsgateClient(
      url: url,
      organizationSlug: organizationSlug,
      headers: headers,
      autoRefreshToken: autoRefreshToken,
      storage: storage,
    );

    final auth = AsgateAuth(options);
    _instance._client = client;
    _instance._asgateAuth = auth;
    await auth.initialize(client);
    return _instance;
  }

  /// Cliente de autenticación.
  AsgateClient get client {
    final client = _client;
    if (client == null) {
      throw StateError(
        'Asgate.initialize() must be called before accessing '
        'Asgate.instance.client',
      );
    }
    return client;
  }

  /// Inicia el login OIDC: obtiene la `authorize_url` y abre el navegador
  /// externo. El resultado se completa vía deep link (requiere
  /// `FlutterAsgateClientOptions(detectSessionInUri: true)`).
  Future<OidcStartResponse> signInWithOAuth() {
    final auth = _asgateAuth;
    if (auth == null) {
      throw StateError('Asgate.initialize() must be called first');
    }
    return auth.signInWithOAuth(client);
  }

  /// Completa el flujo OIDC a partir del deep link del callback
  /// (`?code=...&state=...`). Devuelve la sesión emitida.
  Future<AuthResponse> handleOidcCallback(Uri uri) =>
      client.oauth.handleOidcCallback(uri);

  /// Libera los recursos y permite reinicializar.
  Future<void> dispose() async {
    await _asgateAuth?.dispose();
    await _client?.dispose();
    _client = null;
    _asgateAuth = null;
    _isInitialized = false;
  }
}
