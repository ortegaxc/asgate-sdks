import 'dart:convert';

import 'package:http/http.dart' as http;

import 'types/auth_exception.dart';

/// Métodos HTTP soportados por el SDK.
enum AsgateRequestMethod { get, post, put, patch, delete }

/// Capa HTTP del SDK: serializa el body, envía los headers y mapea las
/// respuestas del envelope `{status_code, message, data}` / errores
/// `{status_code, error: {code, userMessage, details?}}`.
class AsgateFetch {
  AsgateFetch({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<Map<String, dynamic>> request(
    String url,
    AsgateRequestMethod method, {
    Map<String, String>? headers,
    Object? body,
    Map<String, String>? query,
  }) async {
    final uri = Uri.parse(
      url,
    ).replace(queryParameters: (query == null || query.isEmpty) ? null : query);

    final allHeaders = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...?headers,
    };

    http.Response response;
    try {
      final future = switch (method) {
        AsgateRequestMethod.get => _client.get(uri, headers: allHeaders),
        AsgateRequestMethod.post => _client.post(
          uri,
          headers: allHeaders,
          body: json.encode(body ?? const <String, dynamic>{}),
        ),
        AsgateRequestMethod.put => _client.put(
          uri,
          headers: allHeaders,
          body: json.encode(body ?? const <String, dynamic>{}),
        ),
        AsgateRequestMethod.patch => _client.patch(
          uri,
          headers: allHeaders,
          body: json.encode(body ?? const <String, dynamic>{}),
        ),
        AsgateRequestMethod.delete => _client.delete(
          uri,
          headers: allHeaders,
          body: body == null ? null : json.encode(body),
        ),
      };
      response = await future;
    } catch (e) {
      throw AsgateRetryableException('Network error: $e');
    }

    return _handleResponse(response);
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    final json = _decodeBody(response.body);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json;
    }

    final error = json['error'];
    if (error is Map<String, dynamic>) {
      final details = (error['details'] as List<dynamic>? ?? const [])
          .map(
            (e) => e is Map<String, dynamic>
                ? ApiErrorDetail.fromJson(e)
                : ApiErrorDetail(field: '', messages: [e.toString()]),
          )
          .toList();
      throw AsgateApiException(
        statusCode: response.statusCode,
        code: error['code'] as String? ?? 'HTTP_${response.statusCode}',
        userMessage: error['userMessage'] as String? ?? 'Unknown error',
        details: details.isEmpty ? null : details,
      );
    }

    // Fallback para respuestas no estandarizadas.
    final message =
        json['message'] ??
        json['error'] ??
        json['error_description'] ??
        'Unknown error';
    if (response.statusCode >= 500) {
      throw AsgateRetryableException(
        message.toString(),
        statusCode: response.statusCode,
      );
    }
    throw AsgateApiException(
      statusCode: response.statusCode,
      code: 'HTTP_${response.statusCode}',
      userMessage: message.toString(),
    );
  }

  Map<String, dynamic> _decodeBody(String body) {
    if (body.isEmpty) return const {};
    try {
      final decoded = json.decode(body);
      return decoded is Map<String, dynamic> ? decoded : const {};
    } catch (_) {
      return const {};
    }
  }

  void close() => _client.close();
}
