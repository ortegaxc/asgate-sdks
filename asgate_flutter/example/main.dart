import 'package:asgate_flutter/asgate_flutter.dart';
import 'package:flutter/material.dart';

/// Ejemplo mínimo del SDK asgate para Flutter.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Configura el SDK con la URL del servidor de auth y el slug de la org.
  await Asgate.initialize(
    url: 'https://auth.example.com',
    organizationSlug: 'my-org',
  );

  final client = Asgate.instance.client;

  client.onAuthStateChange.listen((state) {
    debugPrint('Auth event: ${state.event}');
  });

  runApp(MyApp(client: client));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key, required this.client});

  final AsgateClient client;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: client.isSignedIn
              ? Text('Signed in as ${client.currentUser?.email}')
              : const Text('Signed out'),
        ),
      ),
    );
  }
}
