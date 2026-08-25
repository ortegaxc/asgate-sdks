/**
 * Smoke test en Node del SDK asgate-js contra un ms-auth real.
 *
 * Requiere un ms-auth corriendo y un usuario + organización existentes.
 *
 * Uso:
 *   BASE_URL=http://localhost:4440 ORG_SLUG=asnexus \
 *     EMAIL=user@x.com PASSWORD=secreta \
 *     node examples/smoke-client.mjs
 */
import { AsgateClient } from '../dist/index.js'

const baseUrl = process.env.BASE_URL ?? 'http://localhost:4440'
const orgSlug = process.env.ORG_SLUG ?? 'asnexus'
const email = process.env.EMAIL
const password = process.env.PASSWORD

function log(label, value) {
  console.log(`\n── ${label} ──`)
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

async function main() {
  if (!email || !password) {
    throw new Error('Faltan EMAIL y PASSWORD en el entorno')
  }

  const client = new AsgateClient({ url: baseUrl, organizationSlug: orgSlug })

  const events = []
  client.onAuthStateChange((event, session) => events.push(event))

  await client.initialize()
  log('initialize events', events)

  // 1) Login
  const login = await client.signInWithPassword({ email, password })
  if (login.isMfaRequired) {
    log('login → MFA requerido', login.mfaRequired?.factors)
    const factor = login.mfaRequired?.factors.find((f) => f.isVerified)
    if (!factor) throw new Error('Sin factores MFA verificados')
    const code = process.env.MFA_CODE
    if (!code) throw new Error('MFA requerido: pasa MFA_CODE')
    const mfa = await client.mfa.verifyMfa({ factorId: factor.id, code })
    log('mfa verify → aal2', { aal: mfa.session?.accessToken ? 'access ok' : 'none' })
  } else {
    log('login → session', { user: login.user?.email, mfaRequired: login.isMfaRequired })
  }

  // 2) Perfil
  const me = await client.getMe()
  log('me', { email: me.email, org: me.organization.slug, roles: me.roles })

  // 3) Política de contraseñas
  const policy = await client.getPasswordPolicy()
  log('password policy', policy)

  // 4) Refresh manual
  const refreshed = await client.refreshSession()
  log('refresh → ok', { accessTokenChanged: refreshed.session?.accessToken !== login.session?.accessToken })

  // 5) Factores MFA
  const factors = await client.mfa.listFactors()
  log('mfa factors', factors)

  // 6) Logout
  await client.signOut()
  log('logout → ok', { isSignedIn: client.isSignedIn })

  console.log('\n✅ Smoke test OK')
}

main().catch((err) => {
  console.error('\n❌ Smoke test falló:', err)
  process.exit(1)
})
