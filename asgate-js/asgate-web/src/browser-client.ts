/**
 * Crea un cliente asgate para el navegador.
 */
import { AsgateClient } from 'asgate-js'
import type { AsgateClientOptions } from 'asgate-js'
import { localStorageAdapter } from './local-storage'
import { detectSessionInUri } from './oidc'

export interface BrowserClientOptions
  extends Omit<AsgateClientOptions, 'storage'> {
  /** Adapter de persistencia (por defecto `localStorage`). */
  storage?: AsgateClientOptions['storage']
  /** Si `true`, detecta un callback OIDC en la URL actual y completa el login. */
  detectSessionInUri?: boolean
  /**
   * Si `true` (default), pausa el auto-refresh al ocultar la pestaña
   * (`visibilitychange`) y lo reanuda al volver (equivalente al manejo de
   * ciclo de vida del wrapper Flutter).
   */
  lifecycleAutoRefresh?: boolean
}

/**
 * Conecta el auto-refresh del cliente al ciclo de vida de la pestaña:
 * `stopAutoRefresh()` al ocultar, `startAutoRefresh()` al volver a ser visible.
 * Devuelve una función para desuscribir el listener.
 */
export function attachLifecycleAutoRefresh(
  client: AsgateClient,
): () => void {
  const onVisibility = (): void => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'hidden') {
      client.stopAutoRefresh()
    } else {
      client.startAutoRefresh()
    }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }
  return () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }
}

/**
 * Crea un `AsgateClient` listo para el navegador: persiste la sesión en
 * `localStorage` y, si `detectSessionInUri` está activo, completa automáticamente
 * un login OIDC pendiente al arrancar.
 */
export function createBrowserClient(
  options: BrowserClientOptions,
): AsgateClient {
  const client = new AsgateClient({
    ...options,
    storage: options.storage ?? localStorageAdapter(),
  })
  if (options.detectSessionInUri ?? false) {
    // Igual que el wrapper Flutter (AsgateAuth._completeOidc): los errores del
    // callback OIDC se rutean al canal de estado vía notifyError.
    void detectSessionInUri(client).catch((error) => client.notifyError(error))
  }
  if (options.lifecycleAutoRefresh ?? true) {
    attachLifecycleAutoRefresh(client)
  }
  return client
}
