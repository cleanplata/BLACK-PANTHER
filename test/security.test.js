import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createCommandRateLimiter, isOwnerOnlyDenied } from '../black/utils/securityPolicy.js'
import { createSecurityStore } from '../black/utils/securityStore.js'

function temporaryPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'black-panther-security-'))
  return { dir, statePath: path.join(dir, 'security.json') }
}

test('owner-only policy denies non-owners and permits owners or public commands', () => {
  assert.equal(isOwnerOnlyDenied({ ownerOnly: true }, false), true)
  assert.equal(isOwnerOnlyDenied({ ownerOnly: true }, true), false)
  assert.equal(isOwnerOnlyDenied({ ownerOnly: false }, false), false)
  assert.equal(isOwnerOnlyDenied({}, false), false)
})

test('sliding-window limiter permits the configured burst then recovers after expiry', () => {
  let now = 1_000
  const limiter = createCommandRateLimiter({ limit: 2, windowMs: 5_000, now: () => now })
  assert.equal(limiter.allow('sender-1'), true)
  assert.equal(limiter.allow('sender-1'), true)
  assert.equal(limiter.allow('sender-1'), false)
  assert.equal(limiter.allow('sender-2'), true)
  now += 5_001
  assert.equal(limiter.allow('sender-1'), true)
})

test('lockdown persists atomically with private permissions and audit entries omit identifiers', () => {
  const { dir, statePath } = temporaryPath()
  try {
    const store = createSecurityStore(statePath)
    assert.equal(store.getState().lockdown, false)
    store.setLockdown(true)
    assert.equal(createSecurityStore(statePath).getState().lockdown, true)
    assert.equal(fs.statSync(statePath).mode & 0o777, 0o600)
    store.audit('owner_command_denied', 'exec')
    const log = fs.readFileSync(path.join(dir, 'panther-security.log'), 'utf8')
    assert.match(log, /owner_command_denied/)
    assert.doesNotMatch(log, /sender|phone|messageBody/i)
    assert.equal(fs.statSync(path.join(dir, 'panther-security.log')).mode & 0o777, 0o600)
    store.setLockdown(false)
    assert.equal(store.getState().lockdown, false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('unreadable or malformed security state fails closed', () => {
  const { dir, statePath } = temporaryPath()
  try {
    fs.writeFileSync(statePath, 'not-json')
    assert.equal(createSecurityStore(statePath).getState().lockdown, true)
    assert.equal(createSecurityStore(statePath).getState().corrupt, true)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
