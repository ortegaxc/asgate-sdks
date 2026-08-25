import 'package:asgate/asgate.dart';
import 'package:flutter/material.dart';

import '../auth_controller.dart';

/// Gestión de factores MFA del usuario (list/enroll/verify/unenroll).
class MfaManageScreen extends StatefulWidget {
  const MfaManageScreen({super.key, required this.client});

  final AsgateClient client;

  @override
  State<MfaManageScreen> createState() => _MfaManageScreenState();
}

class _MfaManageScreenState extends State<MfaManageScreen> {
  List<MfaFactor>? _factors;
  bool _loading = true;
  String? _error;

  AsgateClient get client => widget.client;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final factors = await client.mfa.listFactors();
      if (!mounted) return;
      setState(() {
        _factors = factors;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = AuthController.describe(e);
        _loading = false;
      });
    }
  }

  Future<void> _verifyFactorDialog(String factorId) async {
    final code = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Código de confirmación'),
        content: TextField(
          controller: code,
          keyboardType: TextInputType.number,
          maxLength: 6,
          decoration: const InputDecoration(labelText: 'Código de 6 dígitos'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Verificar'),
          ),
        ],
      ),
    );
    final codeValue = code.text;
    code.dispose();
    if (ok != true) return;
    try {
      await client.mfa.verifyFactor(factorId: factorId, code: codeValue.trim());
      _snack('Factor verificado');
      await _load();
    } catch (e) {
      _snack(AuthController.describe(e));
    }
  }

  Future<void> _enrollTotp() async {
    try {
      final res = await client.mfa.enrollFactor(
        factorType: MfaFactorType.totp,
        friendlyName: 'Demo TOTP',
      );
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Escanea / copia el TOTP'),
          content: SelectableText(res.otpUri ?? 'Sin otpauth URI'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      await _verifyFactorDialog(res.id);
      await _load();
    } catch (e) {
      _snack(AuthController.describe(e));
    }
  }

  Future<void> _enrollSms() async {
    final phone = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Enrolar SMS'),
        content: TextField(
          controller: phone,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(labelText: 'Teléfono (E.164)'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Enviar código'),
          ),
        ],
      ),
    );
    final phoneValue = phone.text;
    phone.dispose();
    if (ok != true) return;
    try {
      final res = await client.mfa.enrollFactor(
        factorType: MfaFactorType.sms,
        friendlyName: 'Demo SMS',
        phone: phoneValue.trim(),
      );
      _snack('Código enviado a ${res.sentTo ?? 'tu teléfono'}');
      await _verifyFactorDialog(res.id);
      await _load();
    } catch (e) {
      _snack(AuthController.describe(e));
    }
  }

  Future<void> _unenroll(MfaFactor factor) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Desenrolar factor'),
        content: Text(
          '¿Quitar ${factor.friendlyName ?? factor.factorType.name}? '
          '(requiere reautenticación si la sesión tiene más de 24 h)',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Quitar'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await client.mfa.unenrollFactor(factorId: factor.id);
      _snack('Factor eliminado');
      await _load();
    } catch (e) {
      _snack(AuthController.describe(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('MFA')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null)
              Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: ListTile(title: Text(_error!)),
              ),
            const SizedBox(height: 8),
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(),
                ),
              )
            else ...[
              for (final f in _factors ?? const <MfaFactor>[])
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
                      '${f.factorType.name} · ${f.status.name}'
                      '${f.phone != null ? ' · ${f.phone}' : ''}',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (!f.isVerified)
                          TextButton(
                            onPressed: () => _verifyFactorDialog(f.id),
                            child: const Text('Verificar'),
                          ),
                        IconButton(
                          tooltip: 'Desenrolar',
                          icon: const Icon(Icons.delete_outline),
                          onPressed: () => _unenroll(f),
                        ),
                      ],
                    ),
                  ),
                ),
              if ((_factors ?? const <MfaFactor>[]).isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Text('No hay factores enrolados.'),
                ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: _enrollTotp,
                      icon: const Icon(Icons.qr_code_2),
                      label: const Text('Enrolar TOTP'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: _enrollSms,
                      icon: const Icon(Icons.sms),
                      label: const Text('Enrolar SMS'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
