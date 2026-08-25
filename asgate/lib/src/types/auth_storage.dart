/// Persistencia de la sesión (JSON completo).
///
/// La implementación concreta la provee el wrapper (p. ej. `flutter_secure_storage`);
/// el core solo persiste/lee la cadena JSON de la sesión.
abstract class AuthStorage {
  Future<void> initialize();

  Future<bool> hasSession();

  Future<String?> loadSession();

  Future<void> persistSession(String persistSessionString);

  Future<void> removeSession();
}

/// Implementación en memoria (tests / sin persistencia).
class InMemoryAuthStorage implements AuthStorage {
  static const String _sessionKey = 'asgate.session';

  final Map<String, String> _store = {};

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasSession() async => _store.containsKey(_sessionKey);

  @override
  Future<String?> loadSession() async => _store[_sessionKey];

  @override
  Future<void> persistSession(String persistSessionString) async {
    _store[_sessionKey] = persistSessionString;
  }

  @override
  Future<void> removeSession() async {
    _store.remove(_sessionKey);
  }
}
