/**
 * Smoke de resolución CJS del paquete compilado (dist/index.cjs).
 * Uso: node test/module-resolution.test.cjs
 */
/* global console */
const assert = require('node:assert/strict')
const {
  AsgateClient,
  createClient,
  AsgateApiException,
  ErrorCodes,
  Session,
  version,
} = require('../dist/index.cjs')

assert.equal(typeof createClient, 'function')
assert.equal(typeof AsgateClient, 'function')
assert.equal(typeof AsgateApiException, 'function')
assert.equal(typeof ErrorCodes.invalidCredentials, 'string')
assert.equal(typeof Session, 'function')
assert.equal(typeof version, 'string')

const client = createClient({ url: 'http://x', organizationSlug: 'acme' })
assert.equal(client.organizationSlug, 'acme')

console.log('✅ CJS module-resolution OK')
