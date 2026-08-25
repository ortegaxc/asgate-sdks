import 'package:asgate_demo/config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('AppConfig tiene defaults válidos', () {
    expect(AppConfig.baseUrl, isNotEmpty);
    expect(AppConfig.organizationSlug, isNotEmpty);
    expect(AppConfig.deepLinkScheme, isNotEmpty);
    expect(AppConfig.oidcCallbackPath, isNotEmpty);
  });
}
