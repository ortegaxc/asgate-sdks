# asgate-web

Wrapper para navegador del SDK [`asgate-js`](../asgate-js).

Añade sobre el core:

- **`localStorageAdapter()`** / **`sessionStorageAdapter()`** — adapters de persistencia de sesión para el navegador.
- **`createBrowserClient()`** — crea un `AsgateClient` con `localStorage`, detección opcional de callback OIDC y auto-refresh por visibilidad de pestaña.
- **`attachLifecycleAutoRefresh()`** — pausa/reanuda el auto-refresh según `visibilitychange` (equivalente al ciclo de vida del wrapper Flutter).
- **`signInWithOAuth()`** — obtiene la `authorize_url` y la abre en una pestaña nueva (equivalente a `Asgate.signInWithOAuth()` de Flutter).
- **`detectSessionInUri()`** — detecta un callback OIDC en la URL actual (fragment con tokens o `?code&state`) y completa el login; los errores se rutean a `notifyError`.

## Uso

```ts
import { createBrowserClient } from 'asgate-web'

const client = createBrowserClient({
  url: 'http://localhost:4440',
  organizationSlug: 'my-org',
  detectSessionInUri: true,
})

await client.initialize()
```

Re-exporta todo el paquete `asgate-js` (tipos, errores, `AsgateClient`, etc.).
