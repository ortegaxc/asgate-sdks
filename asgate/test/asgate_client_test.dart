import 'dart:async';
import 'dart:convert';

import 'package:asgate/asgate.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

Map<String, dynamic> authData({
  String accessToken = 'at-1',
  String refreshToken = 'rt-1',
}) => {
  'access_token': accessToken,
  'refresh_token': refreshToken,
  'token_type': 'bearer',
  'expires_in': 3600,
  'expires_at': '2099-01-01T00:00:00.000Z',
  'user': {'id': 'u1', 'email': 'a@b.c', 'full_name': 'A B'},
};

http.Response okResponse(Map<String, dynamic> data) => http.Response(
  jsonEncode({'status_code': 200, 'message': 'ok', 'data': data}),
  200,
);

Session seededSession() => Session(
  accessToken: 'at-0',
  refreshToken: 'rt-1',
  expiresIn: 3600,
  accessTokenExpiresAt: DateTime.now().add(const Duration(hours: 1)),
  sessionExpiresAt: DateTime.now().add(const Duration(hours: 2)),
  user: AsgateUser(id: 'u1', email: 'a@b.c', fullName: 'A B'),
);

void main() {
  group('AsgateClient', () {
    test('signInWithPassword stores the session and emits signedIn', () async {
      final client = AsgateClient(
        url: 'https://auth.example.com',
        organizationSlug: 'my-org',
        httpClient: MockClient((req) async {
          expect(req.url.path, '/api/v1/auth/login');
          expect(req.headers['X-Organization-Slug'], 'my-org');
          expect(req.headers['X-Auth-Delivery'], 'bearer');
          return okResponse(authData());
        }),
      );

      final events = <AuthChangeEvent>[];
      final eventReceived = Completer<void>();
      final sub = client.onAuthStateChange.listen((s) {
        events.add(s.event);
        if (!eventReceived.isCompleted) eventReceived.complete();
      });

      final res = await client.signInWithPassword(
        email: 'a@b.c',
        password: 'pw',
      );
      await eventReceived.future;
      expect(res.session, isNotNull);
      expect(res.session!.user!.email, 'a@b.c');
      expect(client.isSignedIn, isTrue);
      expect(client.accessToken, 'at-1');
      expect(events, [AuthChangeEvent.signedIn]);

      await sub.cancel();
      await client.dispose();
    });

    test('login API error surfaces AsgateApiException', () async {
      final client = AsgateClient(
        url: 'https://auth.example.com',
        organizationSlug: 'my-org',
        httpClient: MockClient(
          (req) async => http.Response(
            jsonEncode({
              'status_code': 401,
              'error': {
                'code': 'CLG001_INVALID_CREDENTIALS',
                'userMessage': 'Credenciales inválidas',
              },
            }),
            401,
          ),
        ),
      );
      await expectLater(
        client.signInWithPassword(email: 'a@b.c', password: 'bad'),
        throwsA(
          isA<AsgateApiException>().having(
            (e) => e.code,
            'code',
            'CLG001_INVALID_CREDENTIALS',
          ),
        ),
      );
      await client.dispose();
    });

    test('signUp without confirmation emits no session', () async {
      final client = AsgateClient(
        url: 'https://auth.example.com',
        organizationSlug: 'my-org',
        httpClient: MockClient(
          (req) async => okResponse({
            'email_confirmation_required': true,
            'phone_confirmation_required': false,
            'user': {'id': 'u2', 'email': 'new@b.c', 'full_name': 'New'},
          }),
        ),
      );
      final res = await client.signUp(email: 'new@b.c', password: 'pw');
      expect(res.emailConfirmationRequired, isTrue);
      expect(res.requiresConfirmation, isTrue);
      expect(res.session, isNull);
      expect(client.isSignedIn, isFalse);
      await client.dispose();
    });

    test(
      'mfa_required login keeps an aal1 session and exposes factors',
      () async {
        final client = AsgateClient(
          url: 'https://auth.example.com',
          organizationSlug: 'my-org',
          httpClient: MockClient(
            (req) async => okResponse({
              'mfa_required': true,
              'factors': [
                {
                  'id': 'f1',
                  'factor_type': 'totp',
                  'status': 'verified',
                  'friendly_name': 'My TOTP',
                  'phone': null,
                  'last_challenged_at': null,
                  'created_at': '2026-08-17T00:00:00.000Z',
                },
              ],
              'access_token': 'at-aal1',
              'refresh_token': 'rt-aal1',
              'token_type': 'bearer',
              'expires_in': 300,
              'expires_at': '2099-01-01T00:00:00.000Z',
            }),
          ),
        );
        final res = await client.signInWithPassword(
          email: 'a@b.c',
          password: 'pw',
        );
        expect(res.isMfaRequired, isTrue);
        expect(res.mfaRequired!.factors, hasLength(1));
        expect(res.mfaRequired!.factors.first.isVerified, isTrue);
        expect(res.session!.accessToken, 'at-aal1');
        expect(client.isSignedIn, isTrue);
        await client.dispose();
      },
    );

    test('refreshSession deduplicates concurrent refreshes', () async {
      var refreshCalls = 0;
      final client = AsgateClient(
        url: 'https://auth.example.com',
        organizationSlug: 'my-org',
        autoRefreshToken: false,
        httpClient: MockClient((req) async {
          if (req.url.path == '/api/v1/auth/refresh') refreshCalls++;
          return okResponse(authData(accessToken: 'at-$refreshCalls'));
        }),
      );

      await client.recoverSession(seededSession().persistSessionString);

      final f1 = client.refreshSession();
      final f2 = client.refreshSession();
      final r1 = await f1;
      final r2 = await f2;
      expect(identical(r1, r2), isTrue);
      expect(refreshCalls, 1);
      await client.dispose();
    });

    test('initialize restores a persisted session', () async {
      final storage = InMemoryAuthStorage();
      await storage.persistSession(seededSession().persistSessionString);

      final client = AsgateClient(
        url: 'https://auth.example.com',
        organizationSlug: 'my-org',
        autoRefreshToken: false,
        storage: storage,
      );
      await client.initialize();
      expect(client.isSignedIn, isTrue);
      expect(client.currentUser?.email, 'a@b.c');
      await client.dispose();
    });

    test('mfa.listFactors parses an array of factors', () async {
      final client = AsgateClient(
        url: 'https://auth.example.com',
        organizationSlug: 'my-org',
        autoRefreshToken: false,
        httpClient: MockClient(
          (req) async => http.Response(
            jsonEncode({
              'status_code': 200,
              'message': 'ok',
              'data': [
                {
                  'id': 'f1',
                  'factor_type': 'sms',
                  'status': 'verified',
                  'phone': '+56912345678',
                },
              ],
            }),
            200,
          ),
        ),
      );
      final factors = await client.mfa.listFactors();
      expect(factors, hasLength(1));
      expect(factors.first.factorType, MfaFactorType.sms);
      expect(factors.first.isVerified, isTrue);
      await client.dispose();
    });
  });
}
