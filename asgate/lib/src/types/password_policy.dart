/// Política de contraseñas de la organización (`GET /api/v1/auth/password-policy`).
class PasswordPolicy {
  PasswordPolicy({
    required this.minLength,
    required this.complexity,
    required this.rules,
  });

  final int minLength;
  final PasswordComplexity complexity;
  final List<String> rules;

  factory PasswordPolicy.fromJson(Map<String, dynamic> json) => PasswordPolicy(
    minLength: (json['min_length'] as num?)?.toInt() ?? 8,
    complexity: PasswordComplexity.fromValue(json['complexity'] as String?),
    rules: (json['rules'] as List<dynamic>? ?? const [])
        .map((e) => e.toString())
        .toList(),
  );
}

/// Nivel de complejidad de la política de contraseñas.
enum PasswordComplexity {
  none('NONE'),
  lettersAndDigits('LETTERS_AND_DIGITS'),
  lowerUpperDigits('LOWER_UPPER_DIGITS'),
  fullComplexity('FULL_COMPLEXITY');

  const PasswordComplexity(this.value);

  final String value;

  static PasswordComplexity fromValue(String? value) =>
      PasswordComplexity.values.firstWhere(
        (e) => e.value == value,
        orElse: () => PasswordComplexity.lettersAndDigits,
      );
}
