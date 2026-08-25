import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:asgate/asgate.dart';
import 'package:flutter/widgets.dart';
import 'package:url_launcher/url_launcher.dart';

import 'flutter_client_options.dart';

/// Glue entre el core `asgate` y Flutter: observa el ciclo de vida de la app
/// para pausar/reanudar el auto-refresh y maneja el flujo OIDC (lanzar el
/// navegador externo + capturar el deep link del callback).
class AsgateAuth with WidgetsBindingObserver {
  AsgateAuth(this.options);

  final FlutterAsgateClientOptions options;

  AsgateClient? _client;
  StreamSubscription<Uri>? _uriSub;

  Future<void> initialize(AsgateClient client) async {
    _client = client;
    WidgetsBinding.instance.addObserver(this);
    if (options.detectSessionInUri) {
      await _startDeepLinkObserver();
    }
    await client.initialize();
  }

  Future<void> _startDeepLinkObserver() async {
    final appLinks = AppLinks();
    _uriSub = appLinks.uriLinkStream.listen(_handleUri);
    final initial = await appLinks.getInitialLink();
    if (initial != null) _handleUri(initial);
  }

  /// Inicia el login OIDC: obtiene la `authorize_url` y abre el navegador
  /// externo. El resultado llega por deep link → `client.oauth.handleOidcCallback`.
  Future<OidcStartResponse> signInWithOAuth(AsgateClient client) async {
    final res = await client.oauth.getOidcSignInUrl();
    final uri = Uri.tryParse(res.authorizeUrl);
    if (uri == null) {
      throw const AsgateException('Invalid authorize_url');
    }
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched) {
      throw const AsgateException('Could not launch the authorization URL');
    }
    return res;
  }

  void _handleUri(Uri uri) {
    final client = _client;
    if (client == null) return;
    final query = uri.queryParameters;
    if (!query.containsKey('code') || !query.containsKey('state')) return;
    unawaited(_completeOidc(client, uri));
  }

  Future<void> _completeOidc(AsgateClient client, Uri uri) async {
    try {
      await client.oauth.handleOidcCallback(uri);
    } catch (e) {
      client.notifyError(e);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final client = _client;
    if (client == null) return;
    if (state == AppLifecycleState.resumed) {
      client.startAutoRefresh();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached ||
        state == AppLifecycleState.hidden) {
      client.stopAutoRefresh();
    }
  }

  Future<void> dispose() async {
    WidgetsBinding.instance.removeObserver(this);
    await _uriSub?.cancel();
    _uriSub = null;
    _client = null;
  }
}
