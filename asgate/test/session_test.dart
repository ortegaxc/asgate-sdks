import 'dart:convert';

import 'package:asgate/asgate.dart';
import 'package:test/test.dart';

String _makeJwt(Map<String, dynamic> payload) {
  final header = base64Url.encode(utf8.encode(jsonEncode({'alg': 'none'})));
  final body = base64Url.encode(utf8.encode(jsonEncode(payload)));
  return '${header.replaceAll('=', '')}.${body.replaceAll('=', '')}.sig';
}

void main() {
  group('Session', () {
    final now = DateTime.utc(2026, 8, 17);

    Map<String, dynamic> loginJson() => {
      'access_token': 'at-1',
      'refresh_token': 'rt-1',
      'token_type': 'bearer',
      'expires_in': 3600,
      'expires_at': '2026-08-18T00:00:00.000Z',
      'user': {'id': 'u1', 'email': 'a@b.c', 'full_name': 'A B'},
      'must_change_password': false,
    };

    test('parses a login response', () {
      final session = Session.fromJson(loginJson(), now: now);
      expect(session, isNotNull);
      expect(session!.accessToken, 'at-1');
      expect(session.refreshToken, 'rt-1');
      expect(session.expiresIn, 3600);
      expect(session.user!.email, 'a@b.c');
      expect(session.mustChangePassword, isFalse);
      expect(session.accessTokenExpiresAt, now.add(const Duration(hours: 1)));
      expect(session.sessionExpiresAt, DateTime.utc(2026, 8, 18));
    });

    test('returns null without access_token', () {
      expect(Session.fromJson({'refresh_token': 'rt'}), isNull);
    });

    test('persists and restores absolute access-token expiry', () {
      final session = Session.fromJson(loginJson(), now: now);
      final restored = Session.fromPersisted(session!.persistSessionString);
      expect(restored, isNotNull);
      expect(restored!.accessToken, 'at-1');
      expect(restored.refreshToken, 'rt-1');
      expect(restored.accessTokenExpiresAt, session.accessTokenExpiresAt);
      expect(restored.user!.email, 'a@b.c');
    });

    test('isExpired respects the 30s margin', () {
      final session = Session.fromJson({
        'access_token': 'tok',
        'expires_in': 10,
      }, now: DateTime.now());
      expect(session!.isExpired, isTrue);
    });

    test('isSessionExpired reflects the hard deadline', () {
      final expired = Session(
        accessToken: 'tok',
        accessTokenExpiresAt: DateTime.now().add(const Duration(hours: 1)),
        sessionExpiresAt: DateTime.now().subtract(const Duration(minutes: 1)),
      );
      final alive = Session(
        accessToken: 'tok',
        accessTokenExpiresAt: DateTime.now().add(const Duration(hours: 1)),
        sessionExpiresAt: DateTime.now().add(const Duration(hours: 2)),
      );
      expect(expired.isSessionExpired, isTrue);
      expect(alive.isSessionExpired, isFalse);
    });

    test('fromOidcRedirectUrl parses fragment tokens and JWT claims', () {
      final exp = DateTime.utc(2030).millisecondsSinceEpoch ~/ 1000;
      final jwt = _makeJwt({'sub': 'u1', 'email': 'a@b.c', 'exp': exp});
      final session = Session.fromOidcRedirectUrl(
        'https://site.example.com/auth/callback'
        '#access_token=$jwt&refresh_token=rt-1',
      );
      expect(session, isNotNull);
      expect(session!.accessToken, jwt);
      expect(session.refreshToken, 'rt-1');
      expect(session.user!.id, 'u1');
      expect(session.user!.email, 'a@b.c');
      expect(
        session.accessTokenExpiresAt,
        DateTime.fromMillisecondsSinceEpoch(exp * 1000),
      );
    });

    test('fromOidcRedirectUrl returns null without tokens', () {
      expect(
        Session.fromOidcRedirectUrl(
          'https://site.example.com/auth/callback#x=1',
        ),
        isNull,
      );
    });
  });
}
