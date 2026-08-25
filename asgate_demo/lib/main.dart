import 'package:asgate_flutter/asgate_flutter.dart';
import 'package:flutter/material.dart';

import 'auth_controller.dart';
import 'config.dart';
import 'screens/auth_flow_screen.dart';
import 'screens/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Asgate.initialize(
    url: AppConfig.baseUrl,
    organizationSlug: AppConfig.organizationSlug,
    options: const FlutterAsgateClientOptions(detectSessionInUri: true),
  );
  runApp(const AsgateDemoApp());
}

class AsgateDemoApp extends StatefulWidget {
  const AsgateDemoApp({super.key});

  @override
  State<AsgateDemoApp> createState() => _AsgateDemoAppState();
}

class _AsgateDemoAppState extends State<AsgateDemoApp> {
  late final AuthController _auth;

  @override
  void initState() {
    super.initState();
    _auth = AuthController(Asgate.instance.client)..init();
  }

  @override
  void dispose() {
    _auth.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'asgate demo',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: ListenableBuilder(
        listenable: _auth,
        builder: (context, _) {
          if (!_auth.isSignedIn) return AuthFlowScreen(controller: _auth);
          return HomeScreen(controller: _auth);
        },
      ),
    );
  }
}
