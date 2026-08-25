/**
 * Demo web del SDK asgate-js.
 *
 * Ejercita: login/signup, verificación de email, MFA (TOTP/SMS/email),
 * perfil (/me), política de contraseñas, cambio de password/email, OIDC,
 * refresh y restore de sesión (mismo alcance que el SDK Flutter/Dart).
 */
import { AsgateApiException } from 'asgate-js'
import { createBrowserClient } from 'asgate-web'
import type {
  Me,
  MfaFactor,
  MfaFactorType,
  PasswordPolicy,
} from 'asgate-js'
import { resolveConfig, saveConfig, type DemoConfig } from './config'
import './styles.css'

// ─── Cliente ──────────────────────────────────────────────────────────────

const cfg: DemoConfig = resolveConfig()

const client = createBrowserClient({
  url: cfg.baseUrl,
  organizationSlug: cfg.organizationSlug,
  detectSessionInUri: true,
})

// ─── Estado de la UI ──────────────────────────────────────────────────────

type View = 'signedOut' | 'verifyEmail' | 'mfa' | 'home'

const state: {
  view: View
  pendingEmail: string
  mfaFactors: MfaFactor[]
  mfaChallenge: { factorId: string; type: string; sentTo?: string | null } | null
  me: Me | null
  policy: PasswordPolicy | null
  notice: string
} = {
  view: 'signedOut',
  pendingEmail: '',
  mfaFactors: [],
  mfaChallenge: null,
  me: null,
  policy: null,
  notice: '',
}

const app = document.getElementById('app') as HTMLElement
const topbarMeta = document.getElementById('topbar-meta') as HTMLElement

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function setNotice(message: string, isError = false): void {
  state.notice = message
  render()
}

function fmtError(error: unknown): string {
  if (error instanceof AsgateApiException) return `${error.code}: ${error.userMessage}`
  if (error instanceof Error) return error.message
  return String(error)
}

// ─── Helpers de formulario ────────────────────────────────────────────────

function formValue(form: HTMLFormElement, name: string): string {
  const input = form.elements.namedItem(name)
  return input instanceof HTMLInputElement ? input.value : ''
}

async function run(action: () => Promise<void>, successMsg: string): Promise<void> {
  try {
    await action()
    setNotice(successMsg)
  } catch (error) {
    setNotice(fmtError(error), true)
  }
}

// ─── Acciones ─────────────────────────────────────────────────────────────

async function doLogin(form: HTMLFormElement): Promise<void> {
  const email = formValue(form, 'email')
  const password = formValue(form, 'password')
  const res = await client.signInWithPassword({ email, password })
  if (res.isMfaRequired) {
    state.mfaFactors = res.mfaRequired?.factors ?? []
    state.mfaChallenge = null
    state.view = 'mfa'
  } else {
    state.view = 'home'
  }
}

async function doSignup(form: HTMLFormElement): Promise<void> {
  const email = formValue(form, 'email')
  const password = formValue(form, 'password')
  const fullName = formValue(form, 'fullName')
  const res = await client.signUp({ email, password, fullName: fullName || undefined })
  if (res.requiresConfirmation) {
    state.pendingEmail = email
    state.view = 'verifyEmail'
    state.notice = 'Revisa tu email: te enviamos un código de verificación.'
  } else {
    state.view = 'home'
  }
}

async function doVerifyEmail(form: HTMLFormElement): Promise<void> {
  const token = formValue(form, 'token')
  const res = await client.verifyEmail({ token })
  if (res.session) state.view = 'home'
  else state.notice = 'Email verificado. Vuelve a iniciar sesión.'
}

async function doMfaChallenge(form: HTMLFormElement): Promise<void> {
  if (!state.mfaChallenge) return
  const code = formValue(form, 'code')
  await client.mfa.verifyMfa({ factorId: state.mfaChallenge.factorId, code })
  state.mfaChallenge = null
  state.view = 'home'
}

async function refreshMfaFactors(): Promise<void> {
  state.mfaFactors = await client.mfa.listFactors()
}

// ─── Render ───────────────────────────────────────────────────────────────

function render(): void {
  topbarMeta.innerHTML = `<span>${esc(cfg.organizationSlug || '—')}</span><span>${client.isSignedIn ? '● sesión' : '○ sin sesión'}</span>`
  const noticeHtml = state.notice
    ? `<div class="notice">${esc(state.notice)}</div>`
    : ''
  const viewHtml = (() => {
    switch (state.view) {
      case 'signedOut':
        return authFormHtml()
      case 'verifyEmail':
        return verifyEmailHtml()
      case 'mfa':
        return mfaChallengeHtml()
      case 'home':
        return homeHtml()
    }
  })()
  app.innerHTML = configCardHtml() + noticeHtml + viewHtml
  wireConfig()
  switch (state.view) {
    case 'signedOut':
      wireAuthForm()
      break
    case 'verifyEmail':
      wireVerifyEmail()
      break
    case 'mfa':
      wireMfaChallenge()
      break
    case 'home':
      wireHome()
      break
  }
}

/** Tarjeta de configuración (base URL + org slug) editable desde la UI. */
function configCardHtml(): string {
  return `
  <details class="card" open>
    <summary>⚙️ Configuración</summary>
    <form id="config-form" class="row">
      <input name="baseUrl" value="${esc(cfg.baseUrl)}" placeholder="Base URL del despliegue" />
      <input name="organizationSlug" value="${esc(cfg.organizationSlug)}" placeholder="Slug de la organización" />
      <button type="submit">Guardar y recargar</button>
    </form>
    <p class="muted">También acepta <code>?baseUrl=…&amp;org=…</code> en la URL. Sin slug, la demo no puede resolver el tenant.</p>
  </details>`
}

function wireConfig(): void {
  document.getElementById('config-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const baseUrl = formValue(form, 'baseUrl').trim()
    const organizationSlug = formValue(form, 'organizationSlug').trim()
    if (!baseUrl || !organizationSlug) {
      setNotice('Completa la base URL y el slug de la organización', true)
      return
    }
    saveConfig({ baseUrl, organizationSlug })
    window.location.reload()
  })
}

function authFormHtml(): string {
  return `
  <div class="card">
    <h2>Iniciar sesión</h2>
    <form id="login-form">
      <label>Email <input name="email" type="email" required /></label>
      <label>Contraseña <input name="password" type="password" required /></label>
      <button type="submit">Entrar</button>
    </form>
  </div>
  <div class="card">
    <h2>Registrarse</h2>
    <form id="signup-form">
      <label>Email <input name="email" type="email" required /></label>
      <label>Nombre completo <input name="fullName" type="text" /></label>
      <label>Contraseña <input name="password" type="password" required /></label>
      <button type="submit">Crear cuenta</button>
    </form>
  </div>
  <div class="card">
    <h2>OIDC</h2>
    <button id="oidc-start">Iniciar login OIDC</button>
    <p class="muted">Abre el IdP; luego pega la URL del callback (con <code>?code&state</code> o con tokens en el fragment).</p>
    <form id="oidc-callback-form">
      <label>URL del callback <input name="url" type="url" placeholder="https://app/auth/callback#access_token=…" /></label>
      <button type="submit">Completar OIDC</button>
    </form>
  </div>`
}

function wireAuthForm(): void {
  document.getElementById('login-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    void run(() => doLogin(form), 'Sesión iniciada')
  })
  document.getElementById('signup-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    void run(() => doSignup(form), 'Cuenta creada')
  })
  document.getElementById('oidc-start')?.addEventListener('click', async () => {
    try {
      const res = await client.oauth.getOidcSignInUrl()
      setNotice(`Abre esta URL en una pestaña nueva: ${res.authorizeUrl}`)
      window.open(res.authorizeUrl, '_blank')
    } catch (error) {
      setNotice(fmtError(error), true)
    }
  })
  document.getElementById('oidc-callback-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    void run(async () => {
      const url = formValue(form, 'url')
      if (url.includes('#access_token=')) {
        await client.setSessionFromOidcUrl(url)
      } else {
        await client.oauth.handleOidcCallback(url)
      }
      state.view = 'home'
    }, 'Sesión OIDC restaurada')
  })
}

function verifyEmailHtml(): string {
  return `
  <div class="card">
    <h2>Verificar email</h2>
    <p class="muted">Se envió un código a ${esc(state.pendingEmail)}.</p>
    <form id="verify-form">
      <label>Código / token <input name="token" required /></label>
      <button type="submit">Verificar</button>
    </form>
    <button id="resend-btn" class="ghost">Reenviar código</button>
  </div>`
}

function wireVerifyEmail(): void {
  document.getElementById('verify-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    void run(() => doVerifyEmail(form), 'Email verificado')
  })
  document.getElementById('resend-btn')?.addEventListener('click', () => {
    void run(
      async () => {
        await client.resendVerification({ type: 'email', email: state.pendingEmail })
        setNotice('Código reenviado.')
      },
      'Código reenviado',
    )
  })
}

function mfaChallengeHtml(): string {
  const factors = state.mfaFactors
    .filter((f) => f.isVerified)
    .map(
      (f) =>
        `<option value="${esc(f.id)}">${esc(f.factorType)}${f.friendlyName ? ` (${esc(f.friendlyName)})` : ''}</option>`,
    )
    .join('')
  return `
  <div class="card">
    <h2>Verificación en dos pasos (MFA)</h2>
    <form id="mfa-form">
      <label>Factor
        <select name="factorId">${factors}</select>
      </label>
      <button type="button" id="mfa-challenge-btn">Enviar código (si aplica)</button>
      <label>Código de 6 dígitos <input name="code" inputmode="numeric" required /></label>
      <button type="submit">Verificar y continuar</button>
    </form>
    ${state.mfaChallenge?.sentTo ? `<p class="muted">Código enviado a ${esc(state.mfaChallenge.sentTo)}</p>` : ''}
  </div>`
}

function wireMfaChallenge(): void {
  document.getElementById('mfa-challenge-btn')?.addEventListener('click', () => {
    void run(async () => {
      const select = document.querySelector<HTMLSelectElement>('#mfa-form select[name="factorId"]')
      const factorId = select?.value ?? ''
      const factor = state.mfaFactors.find((f) => f.id === factorId)
      if (factor?.factorType === 'totp') {
        state.mfaChallenge = { factorId, type: 'totp' }
      } else {
        const res = await client.mfa.challengeFactor({ factorId })
        state.mfaChallenge = { factorId, type: res.type, sentTo: res.sentTo }
      }
      setNotice('Factor listo. Ingresa el código.')
    }, 'Challenge creado')
  })
  document.getElementById('mfa-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const select = form.elements.namedItem('factorId')
    const factorId = select instanceof HTMLSelectElement ? select.value : ''
    state.mfaChallenge = { factorId, type: 'otp' }
    void run(() => doMfaChallenge(form), 'Segundo factor verificado')
  })
}

function homeHtml(): string {
  const user = client.currentUser
  const me = state.me
  const mfaRows = state.mfaFactors
    .map(
      (f) => `
      <li>
        <code>${esc(f.factorType)}</code> · ${esc(f.status)}${f.friendlyName ? ` · ${esc(f.friendlyName)}` : ''}
        <button class="ghost small" data-unenroll="${esc(f.id)}">Desenrolar</button>
      </li>`,
    )
    .join('')
  return `
  <div class="card">
    <h2>Perfil</h2>
    <p><strong>Email:</strong> ${esc(user?.email ?? me?.email ?? '—')}</p>
    <p><strong>ID:</strong> <code>${esc(user?.id ?? me?.id ?? '—')}</code></p>
    ${me ? `<p><strong>Nombre:</strong> ${esc(me.fullName)}</p><p><strong>Roles:</strong> ${esc(me.roles.join(', '))}</p><p><strong>Org:</strong> ${esc(me.organization.name)} (${esc(me.organization.slug)})</p>` : ''}
    <div class="row">
      <button id="me-btn">GET /me</button>
      <button id="policy-btn">Política de contraseñas</button>
      <button id="refresh-btn">Refresh manual</button>
      <button id="logout-btn">Cerrar sesión</button>
    </div>
    ${state.policy ? `<p class="muted">Política: min ${esc(state.policy.minLength)} · complejidad ${esc(state.policy.complexity)}</p>` : ''}
  </div>

  <div class="card">
    <h2>Cambiar contraseña</h2>
    <form id="pw-form">
      <label>Actual <input name="currentPassword" type="password" /></label>
      <label>Nueva <input name="newPassword" type="password" required /></label>
      <button type="submit">Cambiar</button>
    </form>
  </div>

  <div class="card">
    <h2>Cambiar email</h2>
    <form id="email-form">
      <label>Nuevo email <input name="newEmail" type="email" required /></label>
      <button type="submit">Iniciar cambio</button>
    </form>
    <form id="email-confirm-form" class="mt">
      <label>Token viejo <input name="tokenOld" /></label>
      <label>Token nuevo <input name="tokenNew" required /></label>
      <button type="submit">Confirmar</button>
    </form>
  </div>

  <div class="card">
    <h2>MFA</h2>
    <button id="mfa-refresh">Refrescar factores</button>
    <ul id="mfa-list">${mfaRows || '<li class="muted">Sin factores</li>'}</ul>
    <form id="mfa-enroll-form" class="row">
      <select name="factorType">
        <option value="totp">TOTP (app)</option>
        <option value="sms">SMS</option>
        <option value="email_otp">Email OTP</option>
      </select>
      <input name="phone" placeholder="Teléfono (sms)" />
      <input name="friendlyName" placeholder="Nombre (opcional)" />
      <button type="submit">Enrolar</button>
    </form>
    <form id="mfa-verify-form" class="row mt">
      <input name="factorId" placeholder="factor id" />
      <input name="code" placeholder="código 6 dígitos" inputmode="numeric" />
      <button type="submit">Verificar factor</button>
    </form>
    <div id="mfa-otp-uri" class="muted"></div>
  </div>`
}

function wireHome(): void {
  document.getElementById('me-btn')?.addEventListener('click', () => {
    void run(async () => {
      state.me = await client.getMe()
    }, 'Perfil actualizado')
  })
  document.getElementById('policy-btn')?.addEventListener('click', () => {
    void run(async () => {
      state.policy = await client.getPasswordPolicy()
    }, 'Política cargada')
  })
  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    void run(async () => {
      await client.refreshSession()
    }, 'Sesión renovada')
  })
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    void run(async () => {
      await client.signOut()
      state.view = 'signedOut'
      state.me = null
      state.policy = null
    }, 'Sesión cerrada')
  })

  document.getElementById('pw-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    void run(
      () =>
        client.changePassword({
          currentPassword: formValue(form, 'currentPassword') || undefined,
          newPassword: formValue(form, 'newPassword'),
        }),
      'Contraseña cambiada',
    )
  })

  document.getElementById('email-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    void run(() => client.changeEmail({ newEmail: formValue(form, 'newEmail') }), 'Revisa tus emails (viejo y nuevo) para los tokens')
  })

  document.getElementById('email-confirm-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    void run(
      () =>
        client.changeEmailConfirm({
          tokenOld: formValue(form, 'tokenOld') || undefined,
          tokenNew: formValue(form, 'tokenNew'),
        }),
      'Email cambiado',
    )
  })

  document.getElementById('mfa-refresh')?.addEventListener('click', () => {
    void run(async () => {
      await refreshMfaFactors()
    }, 'Factores actualizados')
  })

  document.querySelectorAll<HTMLButtonElement>('[data-unenroll]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const factorId = btn.dataset['unenroll'] ?? ''
      void run(async () => {
        await client.mfa.unenrollFactor({ factorId })
        await refreshMfaFactors()
      }, 'Factor desenrolado')
    })
  })

  document.getElementById('mfa-enroll-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const factorType = formValue(form, 'factorType') as MfaFactorType
    void run(async () => {
      const res = await client.mfa.enrollFactor({
        factorType,
        phone: formValue(form, 'phone') || undefined,
        friendlyName: formValue(form, 'friendlyName') || undefined,
      })
      const uri = document.getElementById('mfa-otp-uri')
      if (uri) {
        uri.textContent = res.otpUri ? `Escanea con tu app: ${res.otpUri}` : res.sentTo ? `Código enviado a ${res.sentTo}` : 'Factor enrolado (código pendiente).'
      }
      await refreshMfaFactors()
    }, 'Factor enrolado')
  })

  document.getElementById('mfa-verify-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    void run(async () => {
      await client.mfa.verifyFactor({
        factorId: formValue(form, 'factorId'),
        code: formValue(form, 'code'),
      })
      await refreshMfaFactors()
    }, 'Factor verificado')
  })
}

// ─── Arranque ─────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
  client.onAuthStateChange(() => {
    if (client.isSignedIn && state.view === 'signedOut') state.view = 'home'
    render()
  })
  await client.initialize()
  if (client.isSignedIn) state.view = 'home'
  render()
}

void boot()
