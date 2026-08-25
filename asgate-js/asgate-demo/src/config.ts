/**
 * Configuración de la demo.
 *
 * Prioridad de resolución:
 * 1. Query params de la URL: `?baseUrl=...&org=...`
 * 2. Config guardada en `localStorage` (editable desde la UI ⚙️)
 * 3. Valores por defecto de abajo.
 */

export interface DemoConfig {
  baseUrl: string
  organizationSlug: string
}

const STORAGE_KEY = 'asgate.demo.config'

/** Ajusta aquí los valores por defecto (o usa la UI ⚙️ de la demo). */
const DEFAULTS: DemoConfig = {
  // Mismo ms-auth local que usa el demo Flutter (asgate_demo/lib/config.dart):
  // 'http://10.0.2.2:4440' es localhost visto desde el emulador Android.
  baseUrl: 'http://localhost:4440',
  organizationSlug: 'asnexus',
}

export function resolveConfig(): DemoConfig {
  let stored: Partial<DemoConfig> = {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) stored = JSON.parse(raw) as Partial<DemoConfig>
  } catch {
    stored = {}
  }
  const params = new URLSearchParams(window.location.search)
  return {
    baseUrl: params.get('baseUrl') ?? stored.baseUrl ?? DEFAULTS.baseUrl,
    organizationSlug:
      params.get('org') ?? stored.organizationSlug ?? DEFAULTS.organizationSlug,
  }
}

export function saveConfig(cfg: DemoConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    /* localStorage no disponible */
  }
}
