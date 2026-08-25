/**
 * Detección de callback OIDC en la URL actual.
 */
import type { AsgateClient, OidcStartResponse } from 'asgate-js'

/**
 * Inicia el login OIDC custom: obtiene la `authorize_url` y la abre en una
 * pestaña nueva. Equivalente a `Asgate.signInWithOAuth()` del wrapper Flutter.
 *
 * El resultado se completa vía `detectSessionInUri` (fragment con tokens o
 * `?code&state`) al volver a la app.
 */
export async function signInWithOAuth(
  client: AsgateClient,
  options: { target?: string } = {},
): Promise<OidcStartResponse> {
  const res = await client.oauth.getOidcSignInUrl()
  if (typeof window !== 'undefined') {
    window.open(
      res.authorizeUrl,
      options.target ?? '_blank',
      'noopener,noreferrer',
    )
  }
  return res
}

/**
 * Detecta un callback OIDC en la URL actual y completa el login si aplica.
 *
 * Dos casos:
 * 1. La URL ya trae los tokens en el **fragment**
 *    (`.../auth/callback#access_token=...&refresh_token=...`): se restaura la
 *    sesión directamente.
 * 2. La URL trae `?code=...&state=...` (deep link del callback del server):
 *    se intercambia el code contra el backend.
 *
 * Devuelve `true` si se completó un login.
 */
export async function detectSessionInUri(
  client: AsgateClient,
): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const href = window.location.href

  // Caso 1: tokens en el fragment.
  if (href.includes('#access_token=')) {
    const ok = await client.setSessionFromOidcUrl(href)
    if (ok) return true
  }

  // Caso 2: `?code=...&state=...`.
  const url = new URL(href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (code && state) {
    const res = await client.oauth.handleOidcCallback(href)
    if (res.session) {
      // Limpia el query del callback de la URL.
      window.history.replaceState({}, '', url.pathname)
      return true
    }
  }
  return false
}
