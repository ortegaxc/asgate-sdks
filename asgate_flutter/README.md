# Asgate Flutter

A Dart library for handling authentication with access and refresh tokens, inspired by [GoTrue](https://github.com/supabase/gotrue-dart) from Supabase.

## Features

- 🔐 **Secure Token Management**: Handle access tokens and refresh tokens securely
- 🔄 **Automatic Token Refresh**: Tokens are refreshed automatically before expiry
- 💾 **Session Persistence**: Persist sessions across app restarts with customizable storage
- 📡 **Auth State Changes**: Subscribe to authentication state changes via streams
- 👤 **User Management**: Retrieve and update user information
- 🏢 **Multi-Tenant Support**: Two-step authentication for multi-tenant applications
- 🛡️ **Type-Safe**: Full type safety with Dart 3 support

## Installation

Add this to your `pubspec.yaml`:

```yaml
dependencies:
  asgate_flutter:
    path: packages/asgate_flutter
```

## Quick Start

### Initialize the Client

```dart
import 'package:asgate_flutter/asgate_flutter.dart';

final authClient = AsgateAuthClient(
  url: 'https://your-auth-server.com',
  asyncStorage: YourStorageImplementation(), // Optional: for session persistence
);

// Initialize (restores any persisted session)
await authClient.initialize();
```

### Sign In (Simple Flow)

```dart
// With email/password
final response = await authClient.signInWithPassword(
  email: 'user@example.com',
  password: 'your-password',
);

// With phone/password
final response = await authClient.signInWithPassword(
  phone: '+1234567890',
  password: 'your-password',
);

// Access the session and user
print('Access Token: ${response.session?.accessToken}');
print('User: ${response.user?.email}');
```

### Multi-Tenant Authentication (Two-Step Flow)

For applications with multi-tenant support, use the two-step authentication flow:

```dart
// Step 1: Check credentials and get available tenants
final credentials = await authClient.checkCredentials(
  email: 'user@example.com',
  password: 'your-password',
);

// Check if user has multiple tenants
if (credentials.hasMultipleTenants) {
  // Show tenant selection UI to the user
  print('Available tenants:');
  for (final tenant in credentials.availableTenants) {
    print('- ${tenant.name} (${tenant.code})');
  }

  // User selects a tenant...
  final selectedTenant = credentials.availableTenants.first;

  // Step 2: Complete login with selected tenant
  final authResponse = await authClient.selectTenant(
    temporaryToken: credentials.temporaryToken,
    tenantId: selectedTenant.id,
  );

  if (authResponse.isSuccess) {
    print('Logged in as: ${authResponse.user?.email}');
    print('Company: ${authResponse.user?.companyId}');
    print('Permissions: ${authResponse.user?.permissions}');
    print('Roles: ${authResponse.user?.roles}');
  }
} else {
  // Auto-select default tenant if only one
  final authResponse = await authClient.selectTenant(
    temporaryToken: credentials.temporaryToken,
    tenantId: credentials.defaultTenant!.id,
  );
}
```

### Sign Up

```dart
final response = await authClient.signUp(
  email: 'newuser@example.com',
  password: 'secure-password',
  data: {
    'first_name': 'John',
    'last_name': 'Doe',
  },
);
```

### Listen to Auth State Changes

```dart
authClient.onAuthStateChange.listen((state) {
  switch (state.event) {
    case AuthChangeEvent.signedIn:
      print('User signed in: ${state.session?.user.email}');
      break;
    case AuthChangeEvent.signedOut:
      print('User signed out');
      break;
    case AuthChangeEvent.tokenRefreshed:
      print('Token refreshed');
      break;
    case AuthChangeEvent.userUpdated:
      print('User updated');
      break;
    case AuthChangeEvent.initialSession:
      print('Session restored from storage');
      break;
    default:
      break;
  }
});
```

### Get Current User

```dart
// Get cached user
final user = authClient.currentUser;

// Fetch fresh user data from server
final response = await authClient.getUser();
print('User email: ${response.user?.email}');
```

### Update User

```dart
final response = await authClient.updateUser(
  UserAttributes(
    email: 'newemail@example.com',
    data: {'nickname': 'johnd'},
  ),
);
```

### Sign Out

```dart
// Sign out from current device only
await authClient.signOut();

// Sign out from current device, revoking specific refresh token
await authClient.signOut(refreshToken: 'your-refresh-token');

// Sign out from ALL devices (revoke all sessions)
await authClient.signOut(revokeAllSessions: true);
```

### Session Management

```dart
// Check if signed in
if (authClient.isSignedIn) {
  print('User is signed in');
}

// Get current session
final session = authClient.currentSession;
print('Access Token: ${session?.accessToken}');

// Get access token directly
final token = authClient.accessToken;

// Manually refresh session
final response = await authClient.refreshSession();

// Recover session from stored data
final jsonStr = session?.persistSessionString;
await authClient.recoverSession(jsonStr!);
```

## Custom Storage

Implement `AuthAsyncStorage` to provide custom session persistence:

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:asgate_flutter/asgate_flutter.dart';

class SecureAuthStorage implements AuthAsyncStorage {
  final _storage = const FlutterSecureStorage();

  @override
  Future<String?> getItem({required String key}) async {
    return _storage.read(key: key);
  }

  @override
  Future<void> setItem({required String key, required String value}) async {
    await _storage.write(key: key, value: value);
  }

  @override
  Future<void> removeItem({required String key}) async {
    await _storage.delete(key: key);
  }
}

// Use it with the client
final client = AsgateAuthClient(
  url: 'https://your-auth-server.com',
  asyncStorage: SecureAuthStorage(),
);
```

## API Endpoints

The client expects the following API endpoints on your auth server:

| Method | Endpoint                               | Description                         |
| ------ | -------------------------------------- | ----------------------------------- |
| POST   | `/auth/token?grant_type=password`      | Sign in with credentials            |
| POST   | `/auth/token?grant_type=refresh_token` | Refresh token                       |
| POST   | `/auth/signup`                         | Create new account                  |
| POST   | `/auth/logout`                         | Sign out                            |
| GET    | `/auth/user`                           | Get current user                    |
| PUT    | `/auth/user`                           | Update user                         |
| POST   | `/auth/check-credentials`              | Multi-tenant: Validate credentials  |
| POST   | `/auth/select-tenant`                  | Multi-tenant: Select tenant & login |

### Request/Response Formats

#### Check Credentials Request (Multi-Tenant)

```json
POST /auth/check-credentials
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Check Credentials Response

```json
{
  "status": "E",
  "code": "AUT001_0000",
  "businessMessage": "Credentials validated",
  "data": {
    "temporary_token": "temp-token-xyz...",
    "expires_in": 300,
    "available_tenants": [
      {
        "id": "tenant-uuid-1",
        "name": "Company A",
        "code": "COMP_A",
        "is_default": true
      },
      {
        "id": "tenant-uuid-2",
        "name": "Company B",
        "code": "COMP_B",
        "is_default": false
      }
    ],
    "user": {
      "id": "user-uuid",
      "email": "user@example.com"
    }
  }
}
```

#### Select Tenant Request

```json
POST /auth/select-tenant
{
  "temporary_token": "temp-token-xyz...",
  "tenant_id": "tenant-uuid-1"
}
```

#### Select Tenant Response

```json
{
  "status": "E",
  "code": "AUT002_0000",
  "businessMessage": "Login exitoso",
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "abc123...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "company_id": "company-uuid",
      "default_store_id": "store-uuid",
      "permissions": ["read:products", "write:orders"],
      "roles": ["admin", "cashier"]
    }
  }
}
```

#### Sign In Request

```json
POST /auth/token?grant_type=password
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Sign In Response

```json
{
  "access_token": "eyJ...",
  "refresh_token": "abc123...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "app_metadata": {},
    "user_metadata": {}
  }
}
```

#### Refresh Token Request

```json
POST /auth/token?grant_type=refresh_token
{
  "refresh_token": "abc123..."
}
```

## Configuration Options

```dart
final client = AsgateAuthClient(
  // Required: Your auth server URL
  url: 'https://your-auth-server.com',

  // Optional: Custom headers for all requests
  headers: {
    'X-Custom-Header': 'value',
  },

  // Optional: Enable/disable automatic token refresh (default: true)
  autoRefreshToken: true,

  // Optional: Custom HTTP client
  httpClient: http.Client(),

  // Optional: Storage for session persistence
  asyncStorage: YourStorageImplementation(),

  // Optional: Seconds before expiry to refresh token (default: 60)
  expiryMargin: 60,
);
```

## Error Handling

```dart
try {
  await authClient.signInWithPassword(
    email: 'user@example.com',
    password: 'wrong-password',
  );
} on AuthException catch (e) {
  print('Auth error: ${e.message}');
  print('Status code: ${e.statusCode}');
  print('Error code: ${e.errorCode}');
} on SessionExpiredException {
  print('Session has expired');
} on NoSessionException {
  print('No active session');
} on InvalidRefreshTokenException {
  print('Refresh token is invalid');
}
```

## License

MIT License - see LICENSE file for details.
