/**
 * Namespace MFA del cliente asgate (`/api/v1/auth/factors*` y
 * `/api/v1/auth/mfa/verify`).
 */
import type { AsgateClient } from '../asgate-client'
import { AUTH_CONSTANTS } from '../lib/constants'
import {
  parseAuthResponse,
  parseMfaChallengeResult,
  parseMfaEnrollResult,
  parseMfaFactor,
  parseMfaFactorList,
} from '../lib/parsers'
import type {
  AuthResponse,
  MfaChallengeResult,
  MfaEnrollResult,
  MfaFactor,
  MfaFactorType,
} from '../lib/types'

export class AsgateMFAApi {
  constructor(private readonly client: AsgateClient) {}

  /** Lista los factores MFA del usuario. */
  async listFactors(): Promise<MfaFactor[]> {
    const json = await this.client._request(AUTH_CONSTANTS.pathFactors, 'get', {
      authenticated: true,
    })
    return parseMfaFactorList(this.client._data(json))
  }

  /** Enrola un factor MFA. TOTP devuelve `otpUri` (QR); sms/email envían un código. */
  async enrollFactor(params: {
    factorType: MfaFactorType
    friendlyName?: string
    phone?: string
  }): Promise<MfaEnrollResult> {
    const json = await this.client._request(AUTH_CONSTANTS.pathFactors, 'post', {
      authenticated: true,
      body: {
        factor_type: params.factorType,
        ...(params.friendlyName !== undefined
          ? { friendly_name: params.friendlyName }
          : {}),
        ...(params.phone !== undefined ? { phone: params.phone } : {}),
      },
    })
    return parseMfaEnrollResult(this.client._dataMap(json))
  }

  /** Confirma el enrolamiento de un factor con el código de 6 dígitos. */
  async verifyFactor(params: {
    factorId: string
    code: string
  }): Promise<MfaFactor> {
    const json = await this.client._request(
      `${AUTH_CONSTANTS.pathFactors}/${params.factorId}/verify`,
      'post',
      { authenticated: true, body: { code: params.code } },
    )
    const factor = this.client._dataMap(json)['factor']
    return parseMfaFactor(
      factor && typeof factor === 'object'
        ? (factor as Record<string, unknown>)
        : {},
    )
  }

  /** Solicita un código de login para un factor `verified`. */
  async challengeFactor(params: { factorId: string }): Promise<MfaChallengeResult> {
    const json = await this.client._request(
      `${AUTH_CONSTANTS.pathFactors}/${params.factorId}/challenge`,
      'post',
      { authenticated: true },
    )
    return parseMfaChallengeResult(this.client._dataMap(json))
  }

  /** Desenrola un factor MFA (requiere reautenticación si la sesión es vieja). */
  async unenrollFactor(params: { factorId: string }): Promise<void> {
    await this.client._request(
      `${AUTH_CONSTANTS.pathFactors}/${params.factorId}`,
      'delete',
      { authenticated: true, sendReauthentication: true },
    )
  }

  /**
   * Completa el segundo factor: sube la sesión de aal1 a aal2 y devuelve la
   * nueva sesión (emite `mfaChallengeVerified`).
   */
  async verifyMfa(params: {
    factorId: string
    code: string
  }): Promise<AuthResponse> {
    const session = this.client.currentSession
    const json = await this.client._request(AUTH_CONSTANTS.pathMfaVerify, 'post', {
      body: {
        factor_id: params.factorId,
        code: params.code,
        ...(session?.refreshToken
          ? { refresh_token: session.refreshToken }
          : {}),
      },
    })
    const response = parseAuthResponse(this.client._dataMap(json))
    if (response.session) {
      await this.client._saveSession(response.session, 'mfaChallengeVerified')
    }
    return response
  }
}
