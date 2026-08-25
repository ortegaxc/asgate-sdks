import 'package:asgate_flutter/asgate_flutter.dart' as flutter_sdk;
import 'package:flutter/material.dart';

import '../auth_controller.dart';
import '../config.dart';
import 'mfa_manage_screen.dart';

/// Pantalla principal con la sesión activa y acciones de la librería.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.controller});

  final AuthController controller;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  AuthController get controller => widget.controller;

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _guard(Future<void> Function() action) async {
    try {
      await action();
    } catch (e) {
      _snack(AuthController.describe(e));
    }
  }

  Future<void> _me() async {
    await _guard(() async {
      final me = await controller.client.getMe();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Me (perfil)'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _kv('id', me.id),
                _kv('email', me.email ?? '-'),
                _kv('email_verified', '${me.emailVerified}'),
                _kv('phone', me.phone ?? '-'),
                _kv('phone_verified', '${me.phoneVerified}'),
                _kv('is_active', '${me.isActive}'),
                _kv('is_banned', '${me.isBanned}'),
                _kv('roles', me.roles.join(', ')),
                _kv('org', '${me.organization.name} (${me.organization.slug})'),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cerrar'),
            ),
          ],
        ),
      );
    });
  }

  Future<void> _policy() async {
    await _guard(() async {
      final policy = await controller.client.getPasswordPolicy();
      if (!mounted) return;
      _snack(
        'Política: min ${policy.minLength} · ${policy.complexity.name}\n'
        '${policy.rules.join(' · ')}',
      );
    });
  }

  Future<void> _changePassword() async {
    final current = TextEditingController();
    final next = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cambiar contraseña'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: current,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Contraseña actual'),
            ),
            TextField(
              controller: next,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Nueva contraseña'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cambiar'),
          ),
        ],
      ),
    );
    final currentValue = current.text;
    final nextValue = next.text;
    current.dispose();
    next.dispose();
    if (ok != true) return;
    await _guard(
      () => controller.client.changePassword(
        currentPassword: currentValue.isEmpty ? null : currentValue,
        newPassword: nextValue,
      ),
    );
    _snack('Contraseña actualizada');
  }

  Future<void> _changeEmail() async {
    final newEmail = TextEditingController();
    final current = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cambiar email'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: newEmail,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Nuevo email'),
            ),
            TextField(
              controller: current,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Contraseña actual'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Enviar códigos'),
          ),
        ],
      ),
    );
    final newEmailValue = newEmail.text.trim();
    final currentValue = current.text;
    newEmail.dispose();
    current.dispose();
    if (ok != true) return;

    await _guard(
      () => controller.client.changeEmail(
        newEmail: newEmailValue,
        currentPassword: currentValue.isEmpty ? null : currentValue,
      ),
    );
    if (!mounted) return;
    _snack('Códigos enviados (old/new). Confírmalos:');

    await _confirmEmailChange();
  }

  Future<void> _confirmEmailChange() async {
    final tokenOld = TextEditingController();
    final tokenNew = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Confirmar cambio de email'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: tokenOld,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Código email viejo',
              ),
            ),
            TextField(
              controller: tokenNew,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Código email nuevo',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
    final tokenOldValue = tokenOld.text;
    final tokenNewValue = tokenNew.text;
    tokenOld.dispose();
    tokenNew.dispose();
    if (ok != true) return;
    await _guard(
      () => controller.client.changeEmailConfirm(
        tokenOld: tokenOldValue.isEmpty ? null : tokenOldValue.trim(),
        tokenNew: tokenNewValue.trim(),
      ),
    );
    _snack('Email actualizado');
  }

  Future<void> _refresh() async {
    await _guard(() async {
      await controller.client.refreshSession();
      _snack('Sesión renovada');
    });
  }

  Future<void> _oidc() async {
    try {
      await flutter_sdk.Asgate.instance.signInWithOAuth();
      _snack('Navegador abierto. Vuelve al completar el login.');
    } catch (e) {
      _snack(AuthController.describe(e));
    }
  }

  Future<void> _openMfa() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => MfaManageScreen(client: controller.client),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = controller.user;
    return Scaffold(
      appBar: AppBar(
        title: const Text('asgate demo'),
        actions: [
          IconButton(
            tooltip: 'Cerrar sesión',
            icon: const Icon(Icons.logout),
            onPressed: () => controller.logout(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user?.email ?? 'Usuario',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text('Org: ${AppConfig.organizationSlug}'),
                  Text('Sesión: ${controller.isSignedIn}'),
                  Text('Access token: ${_snippet(controller.accessToken)}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          if (controller.error != null)
            Card(
              color: Theme.of(context).colorScheme.errorContainer,
              child: ListTile(
                title: Text(
                  controller.error!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onErrorContainer,
                  ),
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: controller.clearError,
                ),
              ),
            ),
          const SizedBox(height: 8),
          _tile(Icons.badge, 'Me (perfil)', _me),
          _tile(Icons.verified_user, 'Política de contraseñas', _policy),
          _tile(Icons.password, 'Cambiar contraseña', _changePassword),
          _tile(Icons.alternate_email, 'Cambiar email', _changeEmail),
          _tile(Icons.shield, 'MFA (factores)', _openMfa),
          _tile(Icons.login, 'OIDC sign-in', _oidc),
          _tile(Icons.refresh, 'Refrescar sesión', _refresh),
          const SizedBox(height: 16),
          FilledButton.tonalIcon(
            onPressed: () => controller.logout(),
            icon: const Icon(Icons.logout),
            label: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
  }

  Widget _tile(IconData icon, String label, VoidCallback onTap) => ListTile(
    leading: Icon(icon),
    title: Text(label),
    trailing: const Icon(Icons.chevron_right),
    onTap: onTap,
  );

  Widget _kv(String k, String v) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 2),
    child: Text('$k: $v', style: const TextStyle(fontSize: 13)),
  );

  String? _snippet(String? token) {
    if (token == null) return null;
    final cut = token.length < 24 ? token.length : 24;
    return '${token.substring(0, cut)}…';
  }
}
