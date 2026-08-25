import 'dart:async';

import 'package:asgate/asgate.dart';
import 'package:flutter/foundation.dart';

/// Envuelve el `AsgateClient` y lo expone como un `ChangeNotifier` para la UI.
class AuthController extends ChangeNotifier {
  AuthController(this.client);

  final AsgateClient client;

  StreamSubscription<AuthState>? _sub;

  MfaRequiredResult? _mfaRequired;
  bool _busy = false;
  String? _error;
  bool _pendingEmailConfirmation = false;
  String? _pendingVerifyEmail;

  bool get isSignedIn => client.isSignedIn;
  Session? get session => client.currentSession;
  AsgateUser? get user => client.currentUser;
  String? get accessToken => client.accessToken;
  bool get isMfaRequired => _mfaRequired != null;
  MfaRequiredResult? get mfaRequired => _mfaRequired;
  bool get busy => _busy;
  String? get error => _error;
  bool get pendingEmailConfirmation => _pendingEmailConfirmation;
  String? get pendingVerifyEmail => _pendingVerifyEmail;

  void init() {
    _sub = client.onAuthStateChange.listen(
      (state) {
        if (state.event == AuthChangeEvent.signedOut) {
          _mfaRequired = null;
          _pendingEmailConfirmation = false;
          _pendingVerifyEmail = null;
        }
        notifyListeners();
      },
      onError: (Object e) {
        _error = describe(e);
        notifyListeners();
      },
    );
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// Ejecuta [action] con `busy`/`error`; devuelve true si no lanzó.
  Future<bool> run(Future<void> Function() action) async {
    _busy = true;
    _error = null;
    notifyListeners();
    try {
      await action();
      return true;
    } catch (e) {
      _error = describe(e);
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  static String describe(Object e) {
    if (e is AsgateApiException) {
      return '${e.code}: ${e.userMessage}';
    }
    return e.toString();
  }

  // ─── Acciones ───────────────────────────────────────────────────────────

  Future<void> login(String email, String password) async {
    _mfaRequired = null;
    await run(() async {
      final res = await client.signInWithPassword(
        email: email,
        password: password,
      );
      _mfaRequired = res.mfaRequired;
    });
  }

  Future<void> verifyMfa(String factorId, String code) async {
    await run(() async {
      await client.mfa.verifyMfa(factorId: factorId, code: code);
      _mfaRequired = null;
    });
  }

  Future<void> signup(String email, String password, String? fullName) async {
    await run(() async {
      final res = await client.signUp(
        email: email,
        password: password,
        fullName: fullName,
      );
      if (res.emailConfirmationRequired) {
        _pendingEmailConfirmation = true;
        _pendingVerifyEmail = email;
      }
    });
  }

  Future<void> verifyEmail(String token) async {
    await run(() async {
      await client.verifyEmail(token: token);
      _pendingEmailConfirmation = false;
      _pendingVerifyEmail = null;
    });
  }

  Future<void> resendVerification() async {
    await run(
      () => client.resendVerification(
        type: VerificationType.email,
        email: _pendingVerifyEmail,
      ),
    );
  }

  Future<void> logout() async {
    await run(() => client.signOut());
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
