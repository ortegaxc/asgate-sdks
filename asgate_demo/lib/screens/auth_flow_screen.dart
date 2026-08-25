import 'package:asgate/asgate.dart';
import 'package:flutter/material.dart';

import '../auth_controller.dart';
import '../config.dart';

/// Pantalla de autenticación: login/signup, verificación de email tras el
/// signup, y el paso MFA cuando el login lo requiere.
class AuthFlowScreen extends StatefulWidget {
  const AuthFlowScreen({super.key, required this.controller});

  final AuthController controller;

  @override
  State<AuthFlowScreen> createState() => _AuthFlowScreenState();
}

class _AuthFlowScreenState extends State<AuthFlowScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _fullNameCtrl = TextEditingController();
  final _tokenCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();

  bool _signup = false;
  bool _obscure = true;

  // MFA en login
  String? _selectedFactorId;
  MfaChallengeResult? _challenge;

  AuthController get c => widget.controller;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _fullNameCtrl.dispose();
    _tokenCtrl.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_signup) {
      await c.signup(
        _emailCtrl.text.trim(),
        _passwordCtrl.text,
        _fullNameCtrl.text.trim().isEmpty ? null : _fullNameCtrl.text.trim(),
      );
    } else {
      await c.login(_emailCtrl.text.trim(), _passwordCtrl.text);
    }
  }

  Future<void> _challengeFactor(MfaFactor factor) async {
    setState(() {
      _selectedFactorId = factor.id;
      _challenge = null;
    });
    if (factor.factorType != MfaFactorType.totp) {
      final res = await c.client.mfa.challengeFactor(factorId: factor.id);
      if (mounted) setState(() => _challenge = res);
    }
  }

  Future<void> _submitMfa() async {
    final id = _selectedFactorId;
    if (id == null || _codeCtrl.text.length < 6) return;
    await c.verifyMfa(id, _codeCtrl.text);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('asgate demo')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Autenticación de usuarios',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${AppConfig.baseUrl} · ${AppConfig.organizationSlug}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 16),
                  if (c.error != null) _ErrorBanner(controller: c),
                  const SizedBox(height: 8),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    child: _buildPhase(),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPhase() {
    if (c.isMfaRequired) return _buildMfaPhase();
    if (c.pendingEmailConfirmation) return _buildVerifyPhase();
    return _buildAuthForm();
  }

  Widget _buildAuthForm() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_signup)
            TextFormField(
              controller: _fullNameCtrl,
              decoration: const InputDecoration(labelText: 'Nombre completo'),
            ),
          TextFormField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
            validator: (v) =>
                (v == null || !v.contains('@')) ? 'Email inválido' : null,
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _passwordCtrl,
            obscureText: _obscure,
            decoration: InputDecoration(
              labelText: 'Contraseña',
              suffixIcon: IconButton(
                icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
            ),
            validator: (v) => (v == null || v.length < 6) ? 'Mínimo 6' : null,
            onFieldSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: c.busy ? null : _submit,
            child: c.busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(_signup ? 'Crear cuenta' : 'Iniciar sesión'),
          ),
          TextButton(
            onPressed: () => setState(() {
              _signup = !_signup;
              c.clearError();
            }),
            child: Text(
              _signup
                  ? '¿Ya tienes cuenta? Inicia sesión'
                  : '¿No tienes cuenta? Regístrate',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerifyPhase() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Verifica tu email',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Text(
          'Enviamos un código a ${c.pendingVerifyEmail ?? 'tu email'}. '
          'Introdúcelo para confirmar tu cuenta.',
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _tokenCtrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Código OTP'),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: c.busy
              ? null
              : () => c.verifyEmail(_tokenCtrl.text.trim()),
          child: Text(c.busy ? '…' : 'Verificar'),
        ),
        TextButton(
          onPressed: c.busy ? null : c.resendVerification,
          child: const Text('Reenviar código'),
        ),
      ],
    );
  }

  Widget _buildMfaPhase() {
    final factors =
        c.mfaRequired?.factors.where((f) => f.isVerified).toList() ?? [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Verificación en dos pasos',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Text('Elige tu factor MFA e introduce el código.'),
        const SizedBox(height: 12),
        for (final f in factors)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: Icon(switch (f.factorType) {
                MfaFactorType.totp => Icons.qr_code_2,
                MfaFactorType.sms => Icons.sms,
                MfaFactorType.emailOtp => Icons.mail,
              }),
              title: Text(f.friendlyName ?? f.factorType.name),
              subtitle: Text(
                _selectedFactorId == f.id && _challenge != null
                    ? (_challenge!.isTotp
                          ? 'Usa tu app autenticadora'
                          : 'Código enviado a ${_challenge!.sentTo ?? 'tu destino'}')
                    : _selectedFactorId == f.id
                    ? 'Cargando…'
                    : '${f.factorType.name} · ${f.status.name}',
              ),
              selected: _selectedFactorId == f.id,
              onTap: () => _challengeFactor(f),
            ),
          ),
        if (factors.isEmpty)
          const Text('No hay factores MFA verificados en esta org.'),
        const SizedBox(height: 12),
        TextField(
          controller: _codeCtrl,
          keyboardType: TextInputType.number,
          maxLength: 6,
          decoration: const InputDecoration(labelText: 'Código de 6 dígitos'),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: c.busy || _selectedFactorId == null ? null : _submitMfa,
          child: Text(c.busy ? '…' : 'Verificar segundo factor'),
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.controller});

  final AuthController controller;

  @override
  Widget build(BuildContext context) {
    return MaterialBanner(
      backgroundColor: Theme.of(context).colorScheme.errorContainer,
      content: Text(
        controller.error ?? '',
        style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
      ),
      actions: [
        TextButton(onPressed: controller.clearError, child: const Text('OK')),
      ],
    );
  }
}
