import 'package:asgate_flutter/asgate_flutter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('defaultPersistSessionKey deriva una clave estable', () {
    expect(
      defaultPersistSessionKey('https://auth.example.com/', 'my-org'),
      'asgate.session.httpsauthexamplecom.my-org',
    );
    expect(
      defaultPersistSessionKey('https://auth.example.com', 'other'),
      'asgate.session.httpsauthexamplecom.other',
    );
  });

  test('FlutterAsgateClientOptions tiene defaults', () {
    const options = FlutterAsgateClientOptions();
    expect(options.detectSessionInUri, isFalse);
  });
}
