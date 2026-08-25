# asgate-js

SDK de TypeScript/JavaScript para la API de autenticación de **asgate (ms-auth)**.

Estructura del repo (espejo del SDK Dart/Flutter `asgate-sdks`):

| Carpeta | Paquete | Descripción |
| --- | --- | --- |
| [`asgate-js/`](./asgate-js) | `asgate-js` | SDK core: Client Auth API (mismo alcance que el SDK Dart/Flutter). Framework-agnostic (browser + Node). |
| [`asgate-web/`](./asgate-web) | `asgate-web` | Wrapper para navegador: storage en `localStorage`, detección de callback OIDC y helpers de inicialización. |
| [`asgate-demo/`](./asgate-demo) | `asgate-demo` | Demo web (Vite + TypeScript) que ejercita todo el SDK. |

## Paquetes

### `asgate-js` (core)

```ts
import { createClient } from 'asgate-js'

const client = createClient({
  url: 'http://localhost:4440',
  organizationSlug: 'my-org',
})

await client.initialize()
await client.signInWithPassword({ email: 'a@b.com', password: 'secret' })
```

Alcance idéntico al SDK Dart/Flutter (`asgate` / `asgate_flutter`):

- **Client Auth** (`/api/v1/auth/*`): signup, login, refresh, logout, MFA (TOTP/SMS/email), OIDC custom, perfil, verificación email/phone, cambio de password/email, magic links, recovery, invitaciones, reautenticación.

## Desarrollo

Cada paquete es independiente (con deps por `file:`), igual que los SDKs de Dart.

```bash
cd asgate-js/asgate-js
npm install
npm run build
npm test
```
