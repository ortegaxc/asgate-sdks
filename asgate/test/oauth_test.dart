import 'dart:convert';

import 'package:asgate/asgate.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

void main() {
  group('AsgateOAuthApi', () {
    test('getOidcSignInUrl parses provider and authorize_url', () async {
      final client = AsgateClient(
        url: 'https://auth.example.com',
        organizationSlug: 'my-org',
        httpClient: MockClient((req) async {
          expect(req.url.path, '/api/v1/auth/oidc/start');
          expect(req.headers['X-Organization-Slug'], 'my-org');
          return http.Response(
            jsonEncode({
              'status_code': 200,
              'message': 'ok',
              'data': {
                'provider': 'oidc_custom',
                'authorize_url':
                    'https://idp.example.com/authorize?client_id=x&state=s1',
              },
            }),
            200,
          );
        }),
      );
      final res = await client.oauth.getOidcSignInUrl();
      expect(res.provider, 'oidc_custom');
      expect(
        res.authorizeUrl,
        'https://idp.example.com/authorize?client_id=x&state=s1',
      );
      await client.dispose();
    });

    test('handleOidcCallback exchanges code and stores the session', () async {
      final client = AsgateClient(
        url: 'https://auth.example.com',
        organizationSlug: 'my-org',
        autoRefreshToken: false,
        httpClient: MockClient((req) async {
          expect(req.url.path, '/api/v1/auth/oidc/callback');
          expect(req.url.queryParameters['code'], 'c1');
          expect(req.url.queryParameters['state'], 's1');
          return http.Response(
            jsonEncode({
              'status_code': 200,
              'message': 'ok',
              'data': {
                'redirect_url':
                    'https://site.example.com/auth/callback'
                    '#access_token=at-1&refresh_token=rt-1',
              },
            }),
            200,
          );
        }),
      );
      final res = await client.oauth.handleOidcCallback(
        Uri.parse('myapp://auth/callback?code=c1&state=s1'),
      );
      expect(res.session, isNotNull);
      expect(res.session!.accessToken, 'at-1');
      expect(res.session!.refreshToken, 'rt-1');
      expect(client.isSignedIn, isTrue);
      expect(client.accessToken, 'at-1');
      await client.dispose();
    });

    test('handleOidcCallback throws on oauth error', () async {
      final client = AsgateClient(
        url: 'https://auth.example.com',
        organizationSlug: 'my-org',
      );
      await expectLater(
        client.oauth.handleOidcCallback(
          Uri.parse('myapp://cb?error=access_denied&state=s1'),
        ),
        throwsA(isA<AsgateException>()),
      );
      await client.dispose();
    });

    test('handleOidcCallback throws when code/state missing', () async {
      final client = AsgateClient(
        url: 'https://auth.example.com',
        organizationSlug: 'my-org',
      );
      await expectLater(
        client.oauth.handleOidcCallback(Uri.parse('myapp://cb')),
        throwsA(isA<AsgateException>()),
      );
      await client.dispose();
    });
  });
}
