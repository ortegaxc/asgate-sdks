/**
 * Funciones de parseo de los modelos del SDK (de JSON del envelope a tipos TS).
 */
import { parseDate } from './helpers'
import { asString } from './session'
import { Session } from './session'
import type {
  AsgateUser,
  AuthResponse,
  Me,
  MfaChallengeResult,
  MfaEnrollResult,
  MfaFactor,
  MfaFactorStatus,
  MfaFactorType,
  MfaRequiredResult,
  OidcStartResponse,
  Organization,
  PasswordComplexity,
  PasswordPolicy,
  SignupResponse,
} from './types'

export function parseOrganization(json: Record<string, unknown>): Organization {
  return {
    id: asString(json['id']),
    name: asString(json['name']),
    slug: asString(json['slug']),
  }
}

export function parseMe(json: Record<string, unknown>): Me {
  return {
    id: asString(json['id']),
    email: asStringOrNull(json['email']),
    fullName: asString(json['full_name']),
    emailVerified: asBoolOrNull(json['email_verified']),
    phone: asStringOrNull(json['phone']),
    phoneVerified: asBoolOrNull(json['phone_verified']),
    isActive: asBoolOrNull(json['is_active']),
    displayName: asStringOrNull(json['display_name']),
    avatarUrl: asStringOrNull(json['avatar_url']),
    isBanned: asBoolOrNull(json['is_banned']),
    roles: (json['roles'] as unknown[] | undefined)?.map(String) ?? [],
    organization:
      json['organization'] && typeof json['organization'] === 'object'
        ? parseOrganization(json['organization'] as Record<string, unknown>)
        : { id: '', name: '', slug: '' },
  }
}

export function parseMfaFactor(json: Record<string, unknown>): MfaFactor {
  const status = parseMfaFactorStatus(json['status'])
  return {
    id: asString(json['id']),
    factorType: parseMfaFactorType(json['factor_type']),
    status,
    friendlyName: asStringOrNull(json['friendly_name']),
    phone: asStringOrNull(json['phone']),
    lastChallengedAt: parseDate(json['last_challenged_at']),
    createdAt: parseDate(json['created_at']),
    isVerified: status === 'verified',
  }
}

export function parseMfaFactorList(json: unknown): MfaFactor[] {
  if (!Array.isArray(json)) return []
  return json
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object',
    )
    .map((item) => parseMfaFactor(item))
}

export function parseMfaEnrollResult(
  json: Record<string, unknown>,
): MfaEnrollResult {
  return {
    id: asString(json['id']),
    factorType: parseMfaFactorType(json['factor_type']),
    status: parseMfaFactorStatus(json['status']),
    otpUri: asStringOrNull(json['otp_uri']),
    sentTo: asStringOrNull(json['sent_to']),
  }
}

export function parseMfaChallengeResult(
  json: Record<string, unknown>,
): MfaChallengeResult {
  const type = asString(json['type']) || 'totp'
  return {
    type,
    sentTo: asStringOrNull(json['sent_to']),
    isTotp: type === 'totp',
  }
}

export function parseMfaRequiredResult(
  json: Record<string, unknown>,
): MfaRequiredResult {
  return {
    factors: parseMfaFactorList(json['factors']),
  }
}

export function parsePasswordPolicy(
  json: Record<string, unknown>,
): PasswordPolicy {
  return {
    minLength: asNumber(json['min_length']) ?? 8,
    complexity: parsePasswordComplexity(json['complexity']),
    rules: (json['rules'] as unknown[] | undefined)?.map(String) ?? [],
  }
}

export function parseOidcStartResponse(
  json: Record<string, unknown>,
): OidcStartResponse {
  return {
    provider: asString(json['provider']) || 'oidc_custom',
    authorizeUrl: asString(json['authorize_url']),
  }
}

export function parseAuthResponse(
  json: Record<string, unknown>,
  now: Date = new Date(),
): AuthResponse {
  const mfaRequired =
    json['mfa_required'] === true ? parseMfaRequiredResult(json) : null
  const session = Session.fromJson(json, now)
  const user = parseUser(json['user'])
  return {
    session,
    user,
    mfaRequired,
    isMfaRequired: mfaRequired !== null,
  }
}

export function parseSignupResponse(
  json: Record<string, unknown>,
): SignupResponse {
  const emailConfirmationRequired =
    json['email_confirmation_required'] === true
  const phoneConfirmationRequired =
    json['phone_confirmation_required'] === true
  const user =
    parseUser(json['user']) ?? { id: '', email: '', fullName: '' }
  const session = Session.fromJson(json)
  return {
    emailConfirmationRequired,
    phoneConfirmationRequired,
    user,
    session,
    requiresConfirmation:
      emailConfirmationRequired || phoneConfirmationRequired,
  }
}

// ─── Helpers de parseo internos ───────────────────────────────────────────

export function parseUser(json: unknown): AsgateUser | null {
  if (!json || typeof json !== 'object') return null
  const obj = json as Record<string, unknown>
  return {
    id: asString(obj['id']),
    email: asString(obj['email']),
    fullName: asString(obj['full_name']),
  }
}

export function parseMfaFactorType(value: unknown): MfaFactorType {
  const v = asString(value)
  if (v === 'sms' || v === 'email_otp') return v
  return 'totp'
}

export function parseMfaFactorStatus(value: unknown): MfaFactorStatus {
  return value === 'verified' ? 'verified' : 'unverified'
}

export function parsePasswordComplexity(
  value: unknown,
): PasswordComplexity {
  const v = asString(value)
  if (
    v === 'NONE' ||
    v === 'LOWER_UPPER_DIGITS' ||
    v === 'FULL_COMPLEXITY'
  ) {
    return v
  }
  return 'LETTERS_AND_DIGITS'
}

function asStringOrNull(value: unknown): string | null | undefined {
  if (typeof value === 'string') return value
  if (value === null) return null
  return undefined
}

function asBoolOrNull(value: unknown): boolean | null | undefined {
  if (typeof value === 'boolean') return value
  if (value === null) return null
  return undefined
}

function asNumber(value: unknown): number | null | undefined {
  if (typeof value === 'number') return value
  if (value === null) return null
  return undefined
}
