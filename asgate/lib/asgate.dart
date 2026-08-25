/// asgate — Dart client for the asgate enduser authentication API.
///
/// Usage:
/// ```dart
/// final client = AsgateClient(
///   url: 'https://auth.example.com',
///   organizationSlug: 'my-org',
/// );
/// await client.initialize();
/// final res = await client.signInWithPassword(email: ..., password: ...);
/// ```
library;

export 'src/asgate_client.dart';
export 'src/constants.dart';
export 'src/types/auth_exception.dart';
export 'src/types/auth_response.dart';
export 'src/types/auth_state.dart';
export 'src/types/auth_storage.dart';
export 'src/types/error_code.dart';
export 'src/types/me.dart';
export 'src/types/mfa.dart';
export 'src/types/oauth.dart';
export 'src/types/password_policy.dart';
export 'src/types/session.dart';
export 'src/types/user.dart';
