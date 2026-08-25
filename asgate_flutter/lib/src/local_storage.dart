import 'package:asgate/asgate.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const String _storageKeyPrefix = 'asgate.session';

/// Deriva la clave de almacenamiento de la sesión a partir de la URL y el
/// slug de la organización (distintos entornos no colisionan).
String defaultPersistSessionKey(String url, String organizationSlug) {
  final normalized = url.replaceAll(RegExp(r'[^A-Za-z0-9]'), '');
  return '$_storageKeyPrefix.$normalized.$organizationSlug';
}

/// Persiste la sesión en Keychain (iOS) / Keystore (Android).
class SecureAuthStorage implements AuthStorage {
  SecureAuthStorage({required this.storageKey, FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  final String storageKey;
  final FlutterSecureStorage _storage;

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> hasSession() async =>
      await _storage.containsKey(key: storageKey);

  @override
  Future<String?> loadSession() async => _storage.read(key: storageKey);

  @override
  Future<void> persistSession(String persistSessionString) async =>
      _storage.write(key: storageKey, value: persistSessionString);

  @override
  Future<void> removeSession() async => _storage.delete(key: storageKey);
}
