/**
 * asgate-web — wrapper para navegador del SDK asgate-js.
 */
export * from 'asgate-js'
export { localStorageAdapter, sessionStorageAdapter } from './local-storage'
export { createBrowserClient, attachLifecycleAutoRefresh } from './browser-client'
export type { BrowserClientOptions } from './browser-client'
export { detectSessionInUri, signInWithOAuth } from './oidc'
