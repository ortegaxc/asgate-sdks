/**
 * Helpers internos del SDK.
 */

const B64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Valor de un carácter base64 ('=' → 64 = fin de padding). */
function b64Value(ch: string): number {
  return ch === '=' ? 64 : B64_ALPHABET.indexOf(ch)
}

/** Decodifica base64 sin depender de Buffer/atob (funciona en Node y browser). */
function base64UrlDecode(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  let result = ''
  let i = 0
  while (i < padded.length) {
    const e1 = b64Value(padded[i++] ?? '')
    const e2 = b64Value(padded[i++] ?? '')
    const e3 = b64Value(padded[i++] ?? '')
    const e4 = b64Value(padded[i++] ?? '')
    if (e1 < 0 || e2 < 0 || e3 < 0 || e4 < 0) break
    const c1 = (e1 << 2) | (e2 >> 4)
    const c2 = ((e2 & 15) << 4) | (e3 >> 2)
    const c3 = ((e3 & 3) << 6) | e4
    result += String.fromCharCode(c1)
    if (e3 !== 64) result += String.fromCharCode(c2)
    if (e4 !== 64) result += String.fromCharCode(c3)
  }
  return result
}

/**
 * Decodifica el payload de un JWT **sin verificar la firma**.
 * Devuelve un objeto vacío si el token no es un JWT válido.
 */
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.')
  if (parts.length !== 3) return {}
  try {
    const normalized = (parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
    const decoded = base64UrlDecode(normalized)
    const json = JSON.parse(decoded)
    return json && typeof json === 'object'
      ? (json as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/** Normaliza la URL base: recorta espacios y quita los '/' finales. */
export function normalizeUrl(url: string): string {
  let u = url.trim()
  while (u.endsWith('/')) {
    u = u.slice(0, -1)
  }
  return u
}

/**
 * Parsea un valor de fecha (string ISO-8601 o epoch) a Date.
 * Para epoch: si el valor es muy grande, está en milisegundos.
 */
export function parseDate(value: unknown): Date | null {
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'number') {
    if (value > 1e12) return new Date(value)
    return new Date(value * 1000)
  }
  return null
}

/** Sanitiza una URL para usarla como parte de una clave de storage. */
export function sanitizeStorageSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '_')
}

/** Deriva la clave por defecto para persistir la sesión. */
export function defaultPersistSessionKey(
  url: string,
  organizationSlug: string,
): string {
  return `${AUTH_STORAGE_PREFIX}.${sanitizeStorageSegment(url)}.${organizationSlug}`
}

const AUTH_STORAGE_PREFIX = 'asgate.session'
