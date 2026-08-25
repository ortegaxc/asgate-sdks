/**
 * Capa HTTP del SDK: serializa el body, envía los headers y mapea las
 * respuestas del envelope `{status_code, message, data}` / errores
 * `{status_code, error: {code, userMessage, details?}}`.
 */
import {
  AsgateApiException,
  AsgateRetryableException,
  type ApiErrorDetail,
} from './errors'

export type RequestMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

export interface RequestOptions {
  headers?: Record<string, string>
  body?: object | null
  query?: Record<string, string | number | boolean | undefined>
  /** Si `true`, incluye credenciales (cookies httpOnly) en el request. */
  withCredentials?: boolean
}

/** Resuelve la implementación de `fetch` a usar (personalizada o global). */
export function resolveFetch(
  customFetch?: typeof fetch,
): typeof fetch {
  if (customFetch) return customFetch
  if (typeof fetch !== 'undefined') return fetch
  throw new Error(
    'No global fetch found. Pass a custom `fetch` in the client options (Node 18+ exposes a global fetch).',
  )
}

export interface AsgateFetchOptions {
  fetch?: typeof fetch
}

/**
 * Capa de bajo nivel: ejecuta el request, decodifica el envelope y mapea
 * los errores del servidor a las excepciones del SDK.
 */
export class AsgateFetch {
  private readonly fetchImpl: typeof fetch

  constructor(options: AsgateFetchOptions = {}) {
    this.fetchImpl = resolveFetch(options.fetch)
  }

  async request(
    url: string,
    method: RequestMethod,
    options: RequestOptions = {},
  ): Promise<Record<string, unknown>> {
    const fullUrl = appendQuery(url, options.query)

    const allHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    }

    let body: BodyInit | undefined
    if (method !== 'get' && options.body !== undefined && options.body !== null) {
      allHeaders['Content-Type'] = 'application/json'
      body = JSON.stringify(options.body)
    }

    const init: RequestInit = {
      method: method.toUpperCase(),
      headers: allHeaders,
      credentials: options.withCredentials ? 'include' : 'same-origin',
    }
    if (body !== undefined) init.body = body

    let response: Response
    try {
      response = await this.fetchImpl(fullUrl, init)
    } catch (e) {
      throw new AsgateRetryableException(
        `Network error: ${e instanceof Error ? e.message : String(e)}`,
      )
    }

    return this.handleResponse(response)
  }

  /** Mapea una `Response` al envelope y lanza excepciones si corresponde. */
  async handleResponse(response: Response): Promise<Record<string, unknown>> {
    const json = await decodeBody(response)

    if (response.ok) {
      return json
    }

    const error = json['error']
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>
      const details = (errorObj['details'] as unknown[] | undefined)
        ?.map((e): ApiErrorDetail => {
          if (e && typeof e === 'object') {
            const d = e as Record<string, unknown>
            return {
              field: asString(d['field']),
              messages: (d['messages'] as unknown[] | undefined)?.map(String) ?? [],
            }
          }
          return { field: '', messages: [String(e)] }
        })
      throw new AsgateApiException({
        statusCode: response.status,
        code: asString(errorObj['code']) || `HTTP_${response.status}`,
        userMessage: asString(errorObj['userMessage']) || 'Unknown error',
        details: details && details.length > 0 ? details : undefined,
      })
    }

    // Fallback para respuestas no estandarizadas.
    const message =
      json['message'] ??
      json['error'] ??
      json['error_description'] ??
      'Unknown error'
    if (response.status >= 500) {
      throw new AsgateRetryableException(String(message), response.status)
    }
    throw new AsgateApiException({
      statusCode: response.status,
      code: `HTTP_${response.status}`,
      userMessage: String(message),
    })
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────

async function decodeBody(
  response: Response,
): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (text.length === 0) return {}
  try {
    const decoded = JSON.parse(text)
    return decoded && typeof decoded === 'object'
      ? (decoded as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function appendQuery(
  url: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value))
    }
  }
  const qs = params.toString()
  if (qs.length === 0) return url
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
