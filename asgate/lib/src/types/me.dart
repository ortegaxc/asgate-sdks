/// Organización del token (`aud`) en `/me`.
class Organization {
  Organization({required this.id, required this.name, required this.slug});

  final String id;
  final String name;
  final String slug;

  factory Organization.fromJson(Map<String, dynamic> json) => Organization(
    id: json['id'] as String? ?? '',
    name: json['name'] as String? ?? '',
    slug: json['slug'] as String? ?? '',
  );

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'slug': slug};
}

/// Perfil completo del usuario final (`GET /api/v1/auth/me`).
class Me {
  Me({
    required this.id,
    this.email,
    required this.fullName,
    this.emailVerified,
    this.phone,
    this.phoneVerified,
    this.isActive,
    this.displayName,
    this.avatarUrl,
    this.isBanned,
    required this.roles,
    required this.organization,
  });

  final String id;
  final String? email;
  final String fullName;
  final bool? emailVerified;
  final String? phone;
  final bool? phoneVerified;
  final bool? isActive;
  final String? displayName;
  final String? avatarUrl;
  final bool? isBanned;
  final List<String> roles;
  final Organization organization;

  factory Me.fromJson(Map<String, dynamic> json) => Me(
    id: json['id'] as String? ?? '',
    email: json['email'] as String?,
    fullName: json['full_name'] as String? ?? '',
    emailVerified: json['email_verified'] as bool?,
    phone: json['phone'] as String?,
    phoneVerified: json['phone_verified'] as bool?,
    isActive: json['is_active'] as bool?,
    displayName: json['display_name'] as String?,
    avatarUrl: json['avatar_url'] as String?,
    isBanned: json['is_banned'] as bool?,
    roles: (json['roles'] as List<dynamic>? ?? const [])
        .map((e) => e.toString())
        .toList(),
    organization: json['organization'] is Map<String, dynamic>
        ? Organization.fromJson(json['organization'] as Map<String, dynamic>)
        : Organization(id: '', name: '', slug: ''),
  );
}
