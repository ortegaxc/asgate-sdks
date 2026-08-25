import 'dart:convert';

/// Decodifica el payload de un JWT **sin verificar la firma**.
///
/// Devuelve un map vacío si el token no es un JWT válido.
Map<String, dynamic> decodeJwtPayload(String jwt) {
  final parts = jwt.split('.');
  if (parts.length != 3) return const {};
  try {
    final normalized = base64Url.normalize(parts[1]);
    final decoded = utf8.decode(base64Url.decode(normalized));
    final json = jsonDecode(decoded);
    return json is Map<String, dynamic> ? json : const {};
  } catch (_) {
    return const {};
  }
}

/// Parsea un valor de fecha (string ISO-8601 o epoch) a [DateTime].
DateTime? parseDateTime(dynamic value) {
  if (value is String) return DateTime.tryParse(value);
  if (value is int) {
    // Epoch: si el valor es muy grande, está en milisegundos.
    if (value > 1e12) return DateTime.fromMillisecondsSinceEpoch(value);
    return DateTime.fromMillisecondsSinceEpoch(value * 1000);
  }
  return null;
}
