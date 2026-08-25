/**
 * Namespace OAuth/OIDC custom del cliente (`/api/v1/auth/oidc/*`).
 */
import type { AsgateClient } from '../asgate-client'
import { AUTH_CONSTANTS } from '../lib/constants'
import { AsgateException } from '../lib/errors'
import { parseOidcStartResponse } from '../lib/parsers'
import { Session } from '../lib/session'
import type { AuthResponse, OidcStartResponse } from '../lib/types'

export class AsgateOAuthApi {
  constructor(private readonly client: AsgateClient) {}

  /**
   * Inicia el login OIDC custom y devuelve la URL de autorización del IdP
   * (el `state` viaja embebido). La app debe abrir esta URL en el navegador.
   */
  async getOidcSignInUrl(): Promise<OidcStartResponse> {
    const json = await this.client._request(AUTH_CONSTANTS.pathOidcStart, 'get')
    return parseOidcStartResponse(this.client._dataMap(json))
  }

  /**
   * Completa el flujo OIDC a partir del deep link del callback
   * (`?code=...&state=...`). Intercambia el code contra el backend y extrae
   * los tokens del fragment de la `redirect_url` resultante.
   */
  async handleOidcCallback(callbackUri: string | URL): Promise<AuthResponse> {
    const parsed =
      typeof callbackUri === 'string' ? new URL(callbackUri) : callbackUri
    const query = parsed.searchParams

    const error = query.get('error')
    if (error && error.length > 0) {
      throw new AsgateException(`OAuth error: ${error}`)
    }

    const code = query.get('code')
    const state = query.get('state')
    if (!code || !state || code.length === 0 || state.length === 0) {
      throw new AsgateException('OIDC callback missing code or state')
    }

    const json = await this.client._request(
      AUTH_CONSTANTS.pathOidcCallback,
      'get',
      { query: { code, state } },
    )

    const redirectUrl = this.client._dataMap(json)['redirect_url']
    if (typeof redirectUrl !== 'string' || redirectUrl.length === 0) {
      throw new AsgateException(
        'OIDC callback did not return a redirect_url',
      )
    }

    const session = Session.fromOidcRedirectUrl(redirectUrl)
    if (session === null) {
      throw new AsgateException('OIDC redirect_url has no tokens')
    }

    await this.client._saveSession(session, 'signedIn')
    return {
      session,
      user: session.user ?? null,
      mfaRequired: null,
      isMfaRequired: false,
    }
  }
}
