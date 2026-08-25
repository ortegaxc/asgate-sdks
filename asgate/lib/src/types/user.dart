/// Perfil mínimo del usuario final incluido en las respuestas de auth
/// (`ClientAuthUser`: `{id, email, full_name}`).
class AsgateUser {
  AsgateUser({required this.id, required this.email, required this.fullName});

  final String id;
  final String email;
  final String fullName;

  factory AsgateUser.fromJson(Map<String, dynamic> json) => AsgateUser(
    id: json['id'] as String? ?? '',
    email: json['email'] as String? ?? '',
    fullName: json['full_name'] as String? ?? '',
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'full_name': fullName,
  };
}
