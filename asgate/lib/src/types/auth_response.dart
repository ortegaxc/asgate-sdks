import 'mfa.dart';
import 'session.dart';
import 'user.dart';

/// Respuesta de un flujo que emite sesión (login, refresh, verify, MFA, etc.).
class AuthResponse {
  AuthResponse({this.session, AsgateUser? user, this.mfaRequired})
    : user = user ?? session?.user;

  final Session? session;
  final AsgateUser? user;

  /// Presente cuando el login devuelve `mfa_required` (sesión aal1 pendiente).
  final MfaRequiredResult? mfaRequired;

  bool get isMfaRequired => mfaRequired != null;

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    final mfaRequired = json['mfa_required'] == true
        ? MfaRequiredResult.fromJson(json)
        : null;
    final session = Session.fromJson(json);
    return AuthResponse(session: session, mfaRequired: mfaRequired);
  }
}

/// Respuesta de `POST /api/v1/auth/signup`.
class SignupResponse {
  SignupResponse({
    required this.emailConfirmationRequired,
    required this.phoneConfirmationRequired,
    required this.user,
    this.session,
  });

  final bool emailConfirmationRequired;
  final bool phoneConfirmationRequired;
  final AsgateUser user;
  final Session? session;

  bool get requiresConfirmation =>
      emailConfirmationRequired || phoneConfirmationRequired;

  factory SignupResponse.fromJson(Map<String, dynamic> json) => SignupResponse(
    emailConfirmationRequired:
        json['email_confirmation_required'] as bool? ?? false,
    phoneConfirmationRequired:
        json['phone_confirmation_required'] as bool? ?? false,
    user: json['user'] is Map<String, dynamic>
        ? AsgateUser.fromJson(json['user'] as Map<String, dynamic>)
        : AsgateUser(id: '', email: '', fullName: ''),
    session: Session.fromJson(json),
  );
}
