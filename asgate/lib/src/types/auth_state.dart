import '../constants.dart';
import 'session.dart';

/// Estado de autenticación emitido por `AsgateClient.onAuthStateChange`.
class AuthState {
  AuthState(this.event, this.session);

  final AuthChangeEvent event;
  final Session? session;
}
