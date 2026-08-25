/**
 * Smoke de resolución ESM del paquete compilado (dist/index.js).
 * Uso: node test/module-resolution.test.mjs
 */
/* global console */
import assert from 'node:assert/strict'
import {
  AsgateClient,
  createClient,
  AsgateApiException,
  ErrorCodes,
  Session,
  version,
} from '../dist/index.js'

assert.equal(typeof createClient, 'function')
assert.equal(typeof AsgateClient, 'function')
assert.equal(typeof AsgateApiException, 'function')
assert.equal(typeof ErrorCodes.invalidCredentials, 'string')
assert.equal(typeof Session, 'function')
assert.equal(typeof version, 'string')

const client = createClient({ url: 'http://x', organizationSlug: 'acme' })
assert.equal(client.organizationSlug, 'acme')
assert.equal(client.delivery, 'bearer')

console.log('✅ ESM module-resolution OK')
