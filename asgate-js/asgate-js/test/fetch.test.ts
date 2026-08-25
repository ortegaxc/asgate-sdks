import { describe, expect, it } from 'vitest'
import { AsgateFetch } from '../src/lib/fetch'
import {
  AsgateApiException,
  AsgateRetryableException,
} from '../src/lib/errors'
import { createMockFetch } from './helpers'

const ENVELOPE_OK = {
  status_code: 200,
  message: 'Login exitoso',
  data: { access_token: 'tok', refresh_token: 'ref' },
}

const ERROR_ENVELOPE = {
  status_code: 401,
  error: {
    code: 'CLG001_INVALID_CREDENTIALS',
    userMessage: 'Credenciales inválidas',
  },
}

describe('AsgateFetch', () => {
  it('devuelve el envelope en respuestas 2xx', async () => {
    const { fetchImpl } = createMockFetch(() => ({
      status: 200,
      body: ENVELOPE_OK,
    }))
    const fetch = new AsgateFetch({ fetch: fetchImpl })
    const json = await fetch.request('http://x/api/v1/auth/login', 'post', {
      body: { email: 'a@b.c', password: 'x' },
    })
    expect(json['data']).toEqual({ access_token: 'tok', refresh_token: 'ref' })
  })

  it('solo envía Content-Type cuando hay body', async () => {
    const { fetchImpl, calls } = createMockFetch(() => ({
      status: 200,
      body: ENVELOPE_OK,
    }))
    const fetch = new AsgateFetch({ fetch: fetchImpl })
    await fetch.request('http://x/api/v1/auth/me', 'get')
    const headers = calls[0]?.init.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
    expect(headers['Accept']).toBe('application/json')
  })

  it('mapea el envelope de error a AsgateApiException', async () => {
    const { fetchImpl } = createMockFetch(() => ({
      status: 401,
      body: ERROR_ENVELOPE,
    }))
    const fetch = new AsgateFetch({ fetch: fetchImpl })
    await expect(
      fetch.request('http://x/api/v1/auth/login', 'post', {}),
    ).rejects.toMatchObject({
      name: 'AsgateApiException',
      statusCode: 401,
      code: 'CLG001_INVALID_CREDENTIALS',
    })
  })

  it('mapea errores de validación con details', async () => {
    const { fetchImpl } = createMockFetch(() => ({
      status: 400,
      body: {
        status_code: 400,
        error: {
          code: '0900',
          userMessage: 'Validación',
          details: [{ field: 'email', messages: ['Email inválido'] }],
        },
      },
    }))
    const fetch = new AsgateFetch({ fetch: fetchImpl })
    try {
      await fetch.request('http://x/api/v1/auth/signup', 'post', {})
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(AsgateApiException)
      const api = e as AsgateApiException
      expect(api.details?.[0]?.field).toBe('email')
      expect(api.details?.[0]?.messages).toEqual(['Email inválido'])
    }
  })

  it('mapea 5xx a AsgateRetryableException', async () => {
    const { fetchImpl } = createMockFetch(() => ({
      status: 500,
      body: { status_code: 500, message: 'Internal error' },
    }))
    const fetch = new AsgateFetch({ fetch: fetchImpl })
    await expect(fetch.request('http://x/api/v1/auth/me', 'get')).rejects.toBeInstanceOf(
      AsgateRetryableException,
    )
  })

  it('mapea errores de red a AsgateRetryableException', async () => {
    const { fetchImpl } = createMockFetch(() => {
      throw new Error('ECONNREFUSED')
    })
    const fetch = new AsgateFetch({ fetch: fetchImpl })
    await expect(fetch.request('http://x/a', 'get')).rejects.toBeInstanceOf(
      AsgateRetryableException,
    )
  })
})
