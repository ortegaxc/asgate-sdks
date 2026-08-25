/// Opciones específicas de Flutter para el cliente asgate.
class FlutterAsgateClientOptions {
  const FlutterAsgateClientOptions({this.detectSessionInUri = false});

  /// Reservado para OIDC (fase 2): detección de deep links de callback.
  final bool detectSessionInUri;
}
