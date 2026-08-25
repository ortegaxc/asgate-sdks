import 'dart:convert';

import 'package:asgate/asgate.dart';
import 'package:asgate/src/fetch.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

void main() {
  group('AsgateFetch', () {
    test('returns the full envelope on success', () async {
      final fetch = AsgateFetch(
        client: MockClient((req) async {
          expect(req.url.path, '/api/v1/auth/login');
          return http.Response(
            jsonEncode({
              'status_code': 200,
              'message': 'Login exitoso',
              'data': {'access_token': 'x'},
            }),
            200,
          );
        }),
      );
      final json = await fetch.request(
        'https://auth.example.com/api/v1/auth/login',
        AsgateRequestMethod.post,
        body: {'email': 'a@b.c'},
      );
      expect(json['data']['access_token'], 'x');
    });

    test('maps API error envelope to AsgateApiException', () async {
      final fetch = AsgateFetch(
        client: MockClient(
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
        fetch.request(
          'https://auth.example.com/api/v1/auth/login',
          AsgateRequestMethod.post,
        ),
        throwsA(
          isA<AsgateApiException>()
              .having((e) => e.statusCode, 'statusCode', 401)
              .having((e) => e.code, 'code', 'CLG001_INVALID_CREDENTIALS')
              .having(
                (e) => e.isInvalidCredentials,
                'isInvalidCredentials',
                true,
              ),
        ),
      );
    });

    test('maps 5xx to retryable exception', () async {
      final fetch = AsgateFetch(
        client: MockClient((req) async => http.Response('{}', 503)),
      );
      await expectLater(
        fetch.request(
          'https://auth.example.com/api/v1/auth/refresh',
          AsgateRequestMethod.post,
        ),
        throwsA(isA<AsgateRetryableException>()),
      );
    });

    test('maps network errors to retryable exception', () async {
      final fetch = AsgateFetch(
        client: MockClient((req) async {
          throw http.ClientException('connection refused');
        }),
      );
      await expectLater(
        fetch.request(
          'https://auth.example.com/api/v1/auth/refresh',
          AsgateRequestMethod.post,
        ),
        throwsA(isA<AsgateRetryableException>()),
      );
    });

    test('validation error exposes per-field details', () async {
      final fetch = AsgateFetch(
        client: MockClient(
          (req) async => http.Response(
            jsonEncode({
              'status_code': 400,
              'error': {
                'code': 'CSU001_0900',
                'userMessage': 'Datos inválidos',
                'details': [
                  {
                    'field': 'email',
                    'messages': ['invalid email'],
                  },
                ],
              },
            }),
            400,
          ),
        ),
      );
      try {
        await fetch.request(
          'https://auth.example.com/api/v1/auth/signup',
          AsgateRequestMethod.post,
        );
        fail('expected AsgateApiException');
      } on AsgateApiException catch (e) {
        expect(e.code, 'CSU001_0900');
        expect(e.details, isNotNull);
        expect(e.details!.first.field, 'email');
        expect(e.details!.first.messages, ['invalid email']);
      }
    });
  });
}
