import 'dart:async';
import 'dart:math' as math;

import 'package:http/http.dart' as http;
import 'package:meta/meta.dart';
import 'package:rxdart/rxdart.dart';

import 'auth_constants.dart';
import 'constants.dart';
import 'fetch.dart';
import 'types/auth_exception.dart';
import 'types/auth_response.dart';
import 'types/auth_state.dart';
import 'types/auth_storage.dart';
import 'types/me.dart';
import 'types/mfa.dart';
import 'types/oauth.dart';
import 'types/password_policy.dart';
import 'types/session.dart';
import 'types/user.dart';

part 'auth_mfa_api.dart';
part 'auth_oauth_api.dart';

/// Cliente de autenticación de la Client API v3 de asgate.
///
/// ```dart
/// final client = AsgateClient(
///   url: 'https://auth.example.com',
///   organizationSlug: 'my-org',
/// );
/// await client.initialize();
/// ```
class AsgateClient {
  AsgateClient({
    required String url,
    required String organizationSlug,
    Map<String, String>? headers,
    bool autoRefreshToken = true,
    http.Client? httpClient,
    AuthStorage? storage,
  }) : _baseUrl = _normalizeUrl(url),
       _organizationSlug = organizationSlug,
       _headers = headers ?? const {},
       _storage = storage ?? InMemoryAuthStorage(),
       _fetch = AsgateFetch(client: httpClient),
       _autoRefreshToken = autoRefreshToken;

  final String _baseUrl;
  final String _organizationSlug;
  final Map<String, String> _headers;
  final AuthStorage _storage;
  final AsgateFetch _fetch;
  final bool _autoRefreshToken;

  Session? _currentSession;
  AsgateUser? _currentUser;
  String? _reauthenticationToken;

  /// Contador de versión de sesión: evita que un refresh en vuelo pise una
  /// sesión más nueva (sign-in/sign-out ocurridos mientras tanto).
  int _sessionVersion = 0;

  final Map<String, Completer<AuthResponse>> _pendingRefreshes = {};

  Timer? _autoRefreshTicker;

  final ReplaySubject<AuthState> _onAuthStateChangeController =
      ReplaySubject<AuthState>();

  final ReplaySubject<AuthState> _onAuthStateChangeControllerSync =
      ReplaySubject<AuthState>(sync: true);

  /// Stream de cambios de estado de autenticación (replay: los suscriptores
  /// tardíos reciben el último estado).
  Stream<AuthState> get onAuthStateChange =>
      _onAuthStateChangeController.stream;

  /// Variante síncrona para consumidores internos (wrapper).
  @internal
  Stream<AuthState> get onAuthStateChangeSync =>
      _onAuthStateChangeControllerSync.stream;

  /// Sesión actual (access + refresh tokens).
  Session? get currentSession => _currentSession;

  /// Usuario actual (null durante una sesión aal1 pendiente de MFA).
  AsgateUser? get currentUser => _currentUser;

  bool get isSignedIn => _currentSession != null;

  String? get accessToken => _currentSession?.accessToken;

  String? get refreshToken => _currentSession?.refreshToken;

  /// Namespace MFA.
  late final AsgateMFAApi mfa = AsgateMFAApi(this);

  /// Namespace OAuth/OIDC custom.
  late final AsgateOAuthApi oauth = AsgateOAuthApi(this);

  static String _normalizeUrl(String url) {
    var u = url.trim();
    while (u.endsWith('/')) {
      u = u.substring(0, u.length - 1);
    }
    return u;
  }

  // ─── Inicialización / restauración ──────────────────────────────────────

  /// Restaura la sesión persistida (si existe). No lanza: si la restauración
  /// falla, la sesión se limpia y se emite `signedOut`.
  Future<void> initialize() async {
    await _storage.initialize();
    final jsonString = await _storage.loadSession();
    if (jsonString != null && jsonString.isNotEmpty) {
      try {
        await recoverSession(jsonString);
      } on AsgateException {
        // Ya se notificó el estado correspondiente.
      }
    } else {
      _notifyAllSubscribers(AuthChangeEvent.initialSession);
    }
  }

  /// Restaura una sesión persistida, refrescándola si el access token venció.
  Future<AuthResponse> recoverSession(String jsonString) async {
    final session = Session.fromPersisted(jsonString);
    if (session == null) {
      await _removeSession(event: AuthChangeEvent.signedOut);
      throw const AsgateException('Invalid persisted session');
    }
    if (session.isExpired) {
      final token = session.refreshToken;
      if (token != null && !session.isSessionExpired) {
        return _callRefreshToken(token);
      }
      await _removeSession(event: AuthChangeEvent.signedOut);
      throw const AsgateException('Session has expired');
    }
    await _saveSession(session, event: AuthChangeEvent.initialSession);
    return AuthResponse(session: session);
  }

  // ─── Sesión ─────────────────────────────────────────────────────────────

  /// Inicia sesión con email + contraseña.
  Future<AuthResponse> signInWithPassword({
    required String email,
    required String password,
  }) async {
    final json = await _request(
      AuthConstants.pathLogin,
      AsgateRequestMethod.post,
      body: {'email': email, 'password': password},
    );
    return _applyAuthResponse(_dataMap(json));
  }

  /// Registra un usuario final.
  Future<SignupResponse> signUp({
    String? email,
    String? phone,
    required String password,
    String? fullName,
  }) async {
    final json = await _request(
      AuthConstants.pathSignup,
      AsgateRequestMethod.post,
      body: {
        'password': password,
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
        if (fullName != null) 'full_name': fullName,
      },
    );
    final response = SignupResponse.fromJson(_dataMap(json));
    final session = response.session;
    if (session != null) {
      await _saveSession(session, event: AuthChangeEvent.signedIn);
    }
    return response;
  }

  /// Renueva el access token (usa el refresh token actual si no se pasa uno).
  Future<AuthResponse> refreshSession([String? refreshToken]) =>
      _callRefreshToken(refreshToken);

  /// Devuelve la sesión actual; si el access token venció, refresca primero.
  Future<Session?> getSession() async {
    final session = _currentSession;
    if (session == null) return null;
    if (session.isExpired) {
      final refreshed = await _callRefreshToken(session.refreshToken);
      return refreshed.session;
    }
    return session;
  }

  /// Establece una sesión a partir de un refresh token.
  Future<AuthResponse> setSession(String refreshToken) =>
      _callRefreshToken(refreshToken);

  /// Cierra sesión (revoca en el backend según [scope] y limpia localmente).
  Future<void> signOut({SignOutScope scope = SignOutScope.local}) async {
    if (_currentSession != null) {
      try {
        await _request(
          AuthConstants.pathLogout,
          AsgateRequestMethod.post,
          authenticated: true,
          query: {'scope': scope.value},
        );
      } on AsgateException {
        // Se ignora: la sesión local se limpia igual.
      }
    }
    await _removeSession(event: AuthChangeEvent.signedOut);
  }

  // ─── Perfil ─────────────────────────────────────────────────────────────

  /// Obtiene el perfil completo del usuario (`GET /api/v1/auth/me`).
  Future<Me> getMe() async {
    final json = await _request(
      AuthConstants.pathMe,
      AsgateRequestMethod.get,
      authenticated: true,
    );
    final me = Me.fromJson(_dataMap(json));
    _notifyAllSubscribers(AuthChangeEvent.userUpdated);
    return me;
  }

  // ─── Verificación de email / teléfono ───────────────────────────────────

  /// Verifica el email con el OTP (`email_verification`). Emite sesión si la
  /// org no exige más pasos.
  Future<AuthResponse> verifyEmail({required String token}) async {
    final json = await _request(
      AuthConstants.pathVerifyEmail,
      AsgateRequestMethod.post,
      body: {'token': token},
    );
    return _applyAuthResponse(_dataMap(json));
  }

  /// Verifica el teléfono con el OTP SMS.
  Future<bool> verifyPhone({required String code, String? phone}) async {
    final json = await _request(
      AuthConstants.pathVerifyPhone,
      AsgateRequestMethod.post,
      body: {'code': code, if (phone != null) 'phone': phone},
    );
    return _dataMap(json)['verified'] == true;
  }

  /// Reenvía el código de verificación (anti-enumeración: siempre 200).
  Future<bool> resendVerification({
    VerificationType type = VerificationType.email,
    String? email,
    String? phone,
  }) async {
    final json = await _request(
      AuthConstants.pathResendVerification,
      AsgateRequestMethod.post,
      body: {
        'type': type.value,
        if (email != null) 'email': email,
        if (phone != null) 'phone': phone,
      },
    );
    return _dataMap(json)['sent'] == true;
  }

  // ─── Contraseña y email ─────────────────────────────────────────────────

  /// Política de contraseñas de la organización.
  Future<PasswordPolicy> getPasswordPolicy() async {
    final json = await _request(
      AuthConstants.pathPasswordPolicy,
      AsgateRequestMethod.get,
    );
    return PasswordPolicy.fromJson(_dataMap(json));
  }

  /// Cambia la contraseña (revoca las demás sesiones).
  Future<void> changePassword({
    String? currentPassword,
    required String newPassword,
  }) async {
    await _request(
      AuthConstants.pathChangePassword,
      AsgateRequestMethod.post,
      authenticated: true,
      sendReauthentication: true,
      body: {
        'new_password': newPassword,
        if (currentPassword != null) 'current_password': currentPassword,
      },
    );
  }

  /// Inicia el cambio de email (envía los OTP según `secure_email_change`).
  Future<void> changeEmail({
    required String newEmail,
    String? currentPassword,
  }) async {
    await _request(
      AuthConstants.pathChangeEmail,
      AsgateRequestMethod.post,
      authenticated: true,
      sendReauthentication: true,
      body: {
        'new_email': newEmail,
        if (currentPassword != null) 'current_password': currentPassword,
      },
    );
  }

  /// Confirma el cambio de email con los OTP recibidos.
  Future<void> changeEmailConfirm({
    String? tokenOld,
    required String tokenNew,
  }) async {
    await _request(
      AuthConstants.pathChangeEmailConfirm,
      AsgateRequestMethod.post,
      authenticated: true,
      body: {
        'token_new': tokenNew,
        if (tokenOld != null) 'token_old': tokenOld,
      },
    );
  }

  // ─── Tokens de un solo uso ──────────────────────────────────────────────

  /// Verifica un magic link (login sin contraseña).
  Future<AuthResponse> verifyMagicLink({required String token}) async {
    final json = await _request(
      AuthConstants.pathMagicLinkVerify,
      AsgateRequestMethod.post,
      body: {'token': token},
    );
    return _applyAuthResponse(_dataMap(json));
  }

  /// Confirma la recuperación de contraseña (fija la nueva clave + login).
  Future<AuthResponse> recoverPassword({
    required String token,
    required String password,
  }) async {
    final json = await _request(
      AuthConstants.pathRecoveryConfirm,
      AsgateRequestMethod.post,
      body: {'token': token, 'password': password},
    );
    return _applyAuthResponse(_dataMap(json));
  }

  /// Acepta una invitación (fija la contraseña + verifica email + login).
  Future<AuthResponse> acceptInvitation({
    required String token,
    required String password,
  }) async {
    final json = await _request(
      AuthConstants.pathAcceptInvitation,
      AsgateRequestMethod.post,
      body: {'token': token, 'password': password},
    );
    return _applyAuthResponse(_dataMap(json));
  }

  // ─── Reautenticación ────────────────────────────────────────────────────

  /// Envía un OTP de reautenticación al email del usuario.
  Future<bool> reauthenticate() async {
    final json = await _request(
      AuthConstants.pathReauthenticate,
      AsgateRequestMethod.post,
      authenticated: true,
    );
    return _dataMap(json)['sent'] == true;
  }

  /// Confirma el OTP de reautenticación. Almacena el token para enviarlo como
  /// `X-Reauthentication-Token` en operaciones sensibles (cambio de contraseña
  /// o email, desenrolado MFA).
  Future<void> reauthenticateVerify({required String token}) async {
    final json = await _request(
      AuthConstants.pathReauthenticateVerify,
      AsgateRequestMethod.post,
      authenticated: true,
      body: {'token': token},
    );
    if (_dataMap(json)['verified'] == true) {
      _reauthenticationToken = token;
    }
  }

  // ─── Ciclo de vida ──────────────────────────────────────────────────────

  /// Arranca el auto-refresh (lo llama el wrapper al volver a primer plano).
  void startAutoRefresh() {
    if (!_autoRefreshToken) return;
    if (_currentSession != null) _scheduleAutoRefresh();
  }

  /// Detiene el auto-refresh (lo llama el wrapper al pasar a segundo plano).
  void stopAutoRefresh() {
    _autoRefreshTicker?.cancel();
    _autoRefreshTicker = null;
  }

  /// Libera recursos (timers, streams y cliente HTTP).
  Future<void> dispose() async {
    stopAutoRefresh();
    await _onAuthStateChangeController.close();
    await _onAuthStateChangeControllerSync.close();
    _fetch.close();
  }

  // ─── Internals ──────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> _request(
    String path,
    AsgateRequestMethod method, {
    bool authenticated = false,
    bool sendReauthentication = false,
    Map<String, String>? query,
    Object? body,
  }) async {
    final headers = <String, String>{..._headers};

    // Siempre pedimos los tokens en el body (móvil; sin cookie jar).
    headers[AuthConstants.headerAuthDelivery] =
        AuthConstants.authDeliveryBearer;

    if (authenticated) {
      final token = accessToken;
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
      if (sendReauthentication && _reauthenticationToken != null) {
        headers[AuthConstants.headerReauthenticationToken] =
            _reauthenticationToken!;
      }
    } else {
      headers[AuthConstants.headerOrganizationSlug] = _organizationSlug;
    }

    return _fetch.request(
      '$_baseUrl$path',
      method,
      headers: headers,
      body: body,
      query: query,
    );
  }

  dynamic _data(Map<String, dynamic> envelope) => envelope['data'];

  Map<String, dynamic> _dataMap(Map<String, dynamic> envelope) {
    final data = envelope['data'];
    return data is Map<String, dynamic> ? data : const {};
  }

  Future<AuthResponse> _applyAuthResponse(Map<String, dynamic> data) async {
    final response = AuthResponse.fromJson(data);
    final session = response.session;
    if (session != null) {
      await _saveSession(session, event: AuthChangeEvent.signedIn);
    }
    return response;
  }

  Future<void> _saveSession(
    Session session, {
    required AuthChangeEvent event,
  }) async {
    _sessionVersion++;
    _currentSession = session;
    _currentUser = session.user;
    await _storage.persistSession(session.persistSessionString);
    if (_autoRefreshToken) _scheduleAutoRefresh();
    _notifyAllSubscribers(event);
  }

  Future<void> _removeSession({required AuthChangeEvent event}) async {
    _sessionVersion++;
    _currentSession = null;
    _currentUser = null;
    _reauthenticationToken = null;
    _autoRefreshTicker?.cancel();
    _autoRefreshTicker = null;
    await _storage.removeSession();
    _notifyAllSubscribers(event);
  }

  void _notifyAllSubscribers(AuthChangeEvent event) {
    final state = AuthState(event, _currentSession);
    _onAuthStateChangeController.add(state);
    _onAuthStateChangeControllerSync.add(state);
  }

  /// Emite un error en el stream de estado (los callers deben manejar `onError`).
  /// Útil para notificar fallos asíncronos (p. ej. callback OIDC fallido).
  void notifyError(Object error, [StackTrace? stackTrace]) {
    _onAuthStateChangeController.addError(
      error,
      stackTrace ?? StackTrace.current,
    );
  }

  void _scheduleAutoRefresh() {
    _autoRefreshTicker?.cancel();
    _autoRefreshTicker = null;
    if (!_autoRefreshToken) return;
    final session = _currentSession;
    if (session == null) return;
    final expiresAt = session.accessTokenExpiresAt;
    if (expiresAt == null) return;
    final delay = expiresAt
        .subtract(AuthConstants.expiryMargin)
        .difference(DateTime.now());
    _autoRefreshTicker = Timer(
      delay.isNegative ? Duration.zero : delay,
      _autoRefreshTick,
    );
  }

  Future<void> _autoRefreshTick() async {
    final session = _currentSession;
    if (session == null) return;
    try {
      await _callRefreshToken(session.refreshToken);
    } on AsgateException {
      // El refresh ya manejó el error (signOut o reintentos agotados).
    }
  }

  Future<AuthResponse> _callRefreshToken(
    String? refreshToken, {
    int retryCount = 0,
  }) {
    final token = refreshToken ?? this.refreshToken;
    if (token == null || token.isEmpty) {
      return Future.error(const AsgateInvalidRefreshTokenException());
    }
    final pending = _pendingRefreshes[token];
    if (pending != null) return pending.future;

    final completer = Completer<AuthResponse>();
    _pendingRefreshes[token] = completer;
    _doRefresh(token, retryCount)
        .then((r) {
          completer.complete(r);
        })
        .catchError((Object e, StackTrace s) {
          completer.completeError(e, s);
        })
        .whenComplete(() {
          _pendingRefreshes.remove(token);
        });
    return completer.future;
  }

  Future<AuthResponse> _doRefresh(String refreshToken, int retryCount) async {
    final versionBefore = _sessionVersion;
    try {
      final json = await _request(
        AuthConstants.pathRefresh,
        AsgateRequestMethod.post,
        body: {'refresh_token': refreshToken},
      );
      final response = AuthResponse.fromJson(_dataMap(json));
      final session = response.session;
      if (session == null) {
        throw const AsgateException('Refresh did not return a session');
      }
      // Descarta el resultado si la sesión cambió mientras tanto.
      if (_sessionVersion != versionBefore) return response;
      await _saveSession(session, event: AuthChangeEvent.tokenRefreshed);
      return response;
    } on AsgateRetryableException {
      if (retryCount >= AuthConstants.maxRetryCount) rethrow;
      final delay =
          AuthConstants.retryInterval * math.pow(2, retryCount).toInt();
      await Future<void>.delayed(delay);
      return _doRefresh(refreshToken, retryCount + 1);
    } on AsgateApiException catch (e) {
      if (e.isInvalidRefreshToken || e.isSessionExpired) {
        await _removeSession(event: AuthChangeEvent.signedOut);
      }
      rethrow;
    }
  }
}
