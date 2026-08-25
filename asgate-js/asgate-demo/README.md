# asgate-demo

Demo web (Vite + TypeScript) del SDK [`asgate-js`](../asgate-js) / [`asgate-web`](../asgate-web).

## Requisitos

- Un despliegue de `ms-auth` accesible (dev en `http://localhost:4440`, o el de producción).
- Una organización activa (slug) para resolver el tenant.
- **CORS**: el origen de la demo (`http://localhost:5173`) debe estar en `CORS_ALLOWED_ORIGINS` del despliegue.

## Uso

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

### Configuración (sin recompilar)

La demo tiene una tarjeta **⚙️ Configuración** en la parte superior para fijar la
**base URL** y el **slug de la organización** (persiste en `localStorage`). También
acepta query params en la URL:

```
http://localhost:5173/?baseUrl=https://auth.api.augurio.cl&org=miorgtest
```

Si el slug está vacío, la demo no puede resolver el tenant (`X-Organization-Slug`).

## Qué demuestra

- **Login / Signup** con verificación de email (OTP) y reenvío.
- **MFA**: challenge en el login (TOTP/SMS/email), gestión de factores (enrolar TOTP con QR `otpauth://`, SMS, verificar, desenrolar).
- **Perfil** (`GET /api/v1/auth/me`) y **política de contraseñas**.
- **Cambio de contraseña** y **cambio de email** (doble OTP).
- **OIDC custom**: iniciar el flujo y completar el callback (fragment o `?code&state`).
- **Refresh** manual y **restore de sesión** (localStorage) al recargar.
