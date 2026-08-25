/**
 * Helpers de test: mock de `fetch` y utilidades.
 */
export interface MockCall {
  url: string
  init: RequestInit
}

export interface MockResponse {
  status: number
  body: unknown
}

export type MockHandler = (url: string, init: RequestInit) => MockResponse

/**
 * Crea un `fetch` mockeado que responde según el handler.
 * También permite inspeccionar las llamadas realizadas.
 */
export function createMockFetch(handler: MockHandler): {
  fetchImpl: typeof fetch
  calls: MockCall[]
  reset: () => void
} {
  const calls: MockCall[] = []
  const fetchImpl = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const requestInit = init ?? {}
    calls.push({ url, init: requestInit })
    const { status, body } = handler(url, requestInit)
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return {
    fetchImpl: fetchImpl as typeof fetch,
    calls,
    reset: () => {
      calls.length = 0
    },
  }
}

/** Codifica base64url sin padding. */
export function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Crea un JWT falso con el payload dado (sin verificar firma). */
export function fakeJwt(payload: Record<string, unknown>): string {
  return `${base64UrlEncode('{"alg":"none"}')}.${base64UrlEncode(JSON.stringify(payload))}.sig`
}
