/// asgate_flutter — wrapper Flutter para el SDK de autenticación asgate.
///
/// ```dart
/// await Asgate.initialize(
///   url: 'https://auth.example.com',
///   organizationSlug: 'my-org',
/// );
/// final client = Asgate.instance.client;
/// ```
library;

export 'package:asgate/asgate.dart';
export 'src/asgate.dart';
export 'src/flutter_client_options.dart';
export 'src/local_storage.dart';
